import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeClient, type FakeClient } from "../helpers/supabase";

class Redirect extends Error {
  constructor(public to: string) {
    super(`redirect:${to}`);
  }
}
const updateTag = vi.fn();
const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ updateTag, revalidatePath }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Redirect(to);
  },
}));

let db: FakeClient;
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => db }));

const checkLinkUrl = vi.fn<(url: string) => Promise<string | null>>(
  async () => null,
);
vi.mock("@/lib/link-safety", () => ({ checkLinkUrl }));
const allow = vi.fn<(...args: unknown[]) => Promise<boolean>>(async () => true);
vi.mock("@/lib/rate-limit", () => ({ allow }));
const fetchPreviewImage = vi.fn<(url: string) => Promise<string | null>>(
  async () => null,
);
const fetchScreenshot = vi.fn<
  (url: string) => Promise<{ data: ArrayBuffer; type: string } | null>
>(async () => null);
vi.mock("@/lib/link-preview", () => ({ fetchPreviewImage, fetchScreenshot }));

const actions = await import("@/app/dashboard/actions");

const USER = { id: "u1" };
const PROFILE = { id: "p1", username: "ethan", avatar_url: null as string | null };
const AVATARS = "https://x.supabase.co/storage/v1/object/public/avatars/";
const IMAGES = "https://x.supabase.co/storage/v1/object/public/link-images/";

const form = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
};

// A signed-in user who owns PROFILE. `tables` adds results for other
// queries; the first "profiles" result is always the ownership lookup.
function signedIn(tables: Record<string, unknown[]> = {}) {
  db = fakeClient({
    ...tables,
    profiles: [{ data: PROFILE }, ...(tables.profiles ?? [{ error: null }])],
  });
  db.auth.getUser.mockResolvedValue({ data: { user: USER } } as never);
}

const lastWrite = (table: string, method: string) =>
  db.queries[table]
    .flatMap((q) => q.calls)
    .filter((c) => c.method === method)
    .at(-1)?.args;

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
  updateTag.mockClear();
  revalidatePath.mockClear();
  checkLinkUrl.mockReset().mockResolvedValue(null);
  allow.mockReset().mockResolvedValue(true);
  fetchPreviewImage.mockReset().mockResolvedValue(null);
  fetchScreenshot.mockReset().mockResolvedValue(null);
  PROFILE.avatar_url = null;
});

describe("signed-out users", () => {
  beforeEach(() => {
    db = fakeClient();
  });

  it.each([
    ["updateProfile", () => actions.updateProfile(form({}))],
    ["deleteLink", () => actions.deleteLink("l1")],
    ["toggleLink", () => actions.toggleLink("l1", true)],
    ["toggleEmbed", () => actions.toggleEmbed("l1", true)],
    ["reorderLinks", () => actions.reorderLinks([])],
    ["setTheme", () => actions.setTheme("midnight")],
    ["setAvatar", () => actions.setAvatar(null)],
    ["claimUsername", () => actions.claimUsername({}, form({ username: "ethan" }))],
    [
      "updateLink",
      () =>
        actions.updateLink("l1", {}, form({ title: "a", url: "https://a.com" })),
    ],
    [
      "addLink",
      () => actions.addLink({}, form({ title: "a", url: "https://a.com" })),
    ],
    ["updateSocials", () => actions.updateSocials({}, form({}))],
  ])("%s sends them to login and writes nothing", async (_name, run) => {
    await expect(run()).rejects.toMatchObject({ to: "/login" });
    for (const q of Object.values(db.queries).flat()) {
      expect(q.calls.map((c) => c.method)).not.toEqual(
        expect.arrayContaining(["insert"]),
      );
      expect(q.calls.map((c) => c.method)).not.toEqual(
        expect.arrayContaining(["update"]),
      );
      expect(q.calls.map((c) => c.method)).not.toEqual(
        expect.arrayContaining(["delete"]),
      );
    }
  });

  it("users without a profile go back to the dashboard", async () => {
    db.auth.getUser.mockResolvedValue({ data: { user: USER } } as never);
    await expect(actions.deleteLink("l1")).rejects.toMatchObject({
      to: "/dashboard",
    });
  });
});

describe("claimUsername", () => {
  it("validates before touching the database", async () => {
    db = fakeClient();
    expect(await actions.claimUsername({}, form({ username: "admin" }))).toEqual({
      error: "That username is reserved.",
    });
    expect(db.auth.getUser).not.toHaveBeenCalled();
  });

  it("saves the lowercased name for the signed-in user", async () => {
    signedIn();
    expect(
      await actions.claimUsername({}, form({ username: " Ethan " })),
    ).toEqual({});
    expect(lastWrite("profiles", "insert")).toEqual([
      { user_id: "u1", username: "ethan", display_name: "ethan" },
    ]);
    expect(updateTag).toHaveBeenCalledWith("profile:ethan");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
  });

  it.each([
    ["23505", "That username is taken."],
    ["500", "Could not save. Try again."],
  ])("explains database error %s", async (code, message) => {
    db = fakeClient({ profiles: [{ error: { code } }] });
    db.auth.getUser.mockResolvedValue({ data: { user: USER } } as never);
    expect(await actions.claimUsername({}, form({ username: "ethan" }))).toEqual({
      error: message,
    });
  });
});

describe("updateProfile", () => {
  it("caps name and bio length and only updates the user's own row", async () => {
    signedIn();
    await actions.updateProfile(
      form({ display_name: "n".repeat(100), bio: "b".repeat(300) }),
    );
    expect(lastWrite("profiles", "update")).toEqual([
      { display_name: "n".repeat(60), bio: "b".repeat(160) },
    ]);
    expect(lastWrite("profiles", "eq")).toEqual(["id", "p1"]);
  });

  it("handles missing fields", async () => {
    signedIn();
    await actions.updateProfile(form({}));
    expect(lastWrite("profiles", "update")).toEqual([
      { display_name: "", bio: "" },
    ]);
  });
});

describe("addLink", () => {
  it("needs a title and a URL", async () => {
    expect(await actions.addLink({}, form({ title: " ", url: "x" }))).toEqual({
      error: "Add a title and a URL.",
    });
  });

  it("adds https:// when the scheme is missing", async () => {
    signedIn({ links: [{ count: 0 }, { error: null }] });
    await actions.addLink({}, form({ title: "Site", url: "example.com" }));
    expect(checkLinkUrl).toHaveBeenCalledWith("https://example.com");
  });

  it("refuses links that fail the safety check", async () => {
    checkLinkUrl.mockResolvedValueOnce("unsafe!");
    db = fakeClient();
    expect(
      await actions.addLink({}, form({ title: "x", url: "javascript:alert(1)" })),
    ).toEqual({ error: "unsafe!" });
    expect(db.from).not.toHaveBeenCalled();
  });

  it("refuses an end time before the start time", async () => {
    expect(
      await actions.addLink(
        {},
        form({
          title: "x",
          url: "https://a.com",
          starts_at: "2026-10-14T10:00:00Z",
          ends_at: "2026-10-14T09:00:00Z",
        }),
      ),
    ).toEqual({ error: "The end time must be after the start time." });
  });

  it("rate-limits fast adding", async () => {
    signedIn();
    allow.mockResolvedValueOnce(false);
    expect(
      await actions.addLink({}, form({ title: "x", url: "https://a.com" })),
    ).toEqual({ error: "You're adding links very fast. Wait a few minutes." });
    expect(allow).toHaveBeenCalledWith("addlink:p1", 30, 600);
  });

  it("caps each page at 100 links", async () => {
    signedIn({ links: [{ count: 100 }] });
    expect(
      await actions.addLink({}, form({ title: "x", url: "https://a.com" })),
    ).toEqual({ error: "You can have up to 100 links." });
  });

  it("saves the link at the end with its schedule and embed", async () => {
    signedIn({ links: [{ count: 3 }, { error: null }] });
    expect(
      await actions.addLink(
        {},
        form({
          title: " Video ",
          url: "https://youtu.be/dQw4w9WgXcQ",
          embed: "on",
          starts_at: "2026-10-14T10:00:00+02:00",
          ends_at: "garbage",
        }),
      ),
    ).toEqual({});
    expect(lastWrite("links", "insert")).toEqual([
      {
        profile_id: "p1",
        title: "Video",
        url: "https://youtu.be/dQw4w9WgXcQ",
        position: 3,
        embed: true,
        size: "small",
        image_url: null,
        preview_url: null,
        starts_at: "2026-10-14T08:00:00.000Z",
        ends_at: null,
      },
    ]);
    // Small buttons don't need the page's preview picture.
    expect(fetchPreviewImage).not.toHaveBeenCalled();
    expect(updateTag).toHaveBeenCalledWith("profile:ethan");
  });

  it("only embeds links that can be embedded", async () => {
    signedIn({ links: [{ count: null }, { error: null }] });
    await actions.addLink(
      {},
      form({ title: "x", url: "https://a.com", embed: "on" }),
    );
    expect(lastWrite("links", "insert")?.[0]).toMatchObject({
      embed: false,
      position: 0,
    });
  });

  it("saves a big button with the user's own picture", async () => {
    signedIn({ links: [{ count: 0 }, { error: null }] });
    expect(
      await actions.addLink(
        {},
        form({
          title: "x",
          url: "https://a.com",
          size: "big",
          image_url: `${IMAGES}u1/a.jpg`,
        }),
      ),
    ).toEqual({});
    expect(lastWrite("links", "insert")?.[0]).toMatchObject({
      size: "big",
      image_url: `${IMAGES}u1/a.jpg`,
    });
  });

  it("gives a big button without a picture the page's preview", async () => {
    signedIn({ links: [{ count: 0 }, { error: null }] });
    fetchPreviewImage.mockResolvedValueOnce("https://cdn.a.com/og.jpg");
    await actions.addLink(
      {},
      form({ title: "x", url: "https://a.com", size: "big" }),
    );
    expect(fetchPreviewImage).toHaveBeenCalledWith("https://a.com");
    expect(lastWrite("links", "insert")?.[0]).toMatchObject({
      image_url: null,
      preview_url: "https://cdn.a.com/og.jpg",
    });
  });

  it("saves a screenshot when the page has no share picture", async () => {
    signedIn({ links: [{ count: 0 }, { error: null }] });
    const data = new ArrayBuffer(8);
    fetchScreenshot.mockResolvedValueOnce({ data, type: "image/jpeg" });
    await actions.addLink(
      {},
      form({ title: "x", url: "https://a.com", size: "big" }),
    );
    expect(fetchScreenshot).toHaveBeenCalledWith("https://a.com");
    const [path, body, opts] = db.storage.upload.mock.calls[0];
    expect(path).toMatch(/^u1\/preview-[\w-]+\.jpeg$/);
    expect(body).toBe(data);
    expect(opts).toEqual({ contentType: "image/jpeg" });
    expect(lastWrite("links", "insert")?.[0]).toMatchObject({
      preview_url: `${IMAGES}${path}`,
    });
  });

  it("takes a screenshot instead of a site icon, and keeps the icon if that fails", async () => {
    signedIn({ links: [{ count: 0 }, { error: null }] });
    const icon = "https://a.com/i.svg#biolyn-icon";
    fetchPreviewImage.mockResolvedValueOnce(icon);
    fetchScreenshot.mockResolvedValueOnce({ data: new ArrayBuffer(8), type: "image/png" });
    db.storage.upload.mockResolvedValueOnce({ data: null, error: { message: "x" } });
    await actions.addLink(
      {},
      form({ title: "x", url: "https://a.com", size: "big" }),
    );
    expect(fetchScreenshot).toHaveBeenCalled();
    expect(lastWrite("links", "insert")?.[0]).toMatchObject({ preview_url: icon });
  });

  it("refuses a picture from someone else's folder", async () => {
    signedIn();
    expect(
      await actions.addLink(
        {},
        form({
          title: "x",
          url: "https://a.com",
          size: "big",
          image_url: `${IMAGES}u2/a.jpg`,
        }),
      ),
    ).toEqual({ error: "Could not use that picture. Upload it again." });
    expect(db.from).not.toHaveBeenCalledWith("links");
  });

  it("reports a failed save", async () => {
    signedIn({ links: [{ count: 0 }, { error: { message: "x" } }] });
    expect(
      await actions.addLink({}, form({ title: "x", url: "https://a.com" })),
    ).toEqual({ error: "Could not save the link." });
  });
});

describe("single-link actions", () => {
  beforeEach(() => signedIn());

  it("toggleEmbed flips the embed flag", async () => {
    await actions.toggleEmbed("l1", true);
    expect(lastWrite("links", "update")).toEqual([{ embed: false }]);
    expect(lastWrite("links", "eq")).toEqual(["id", "l1"]);
  });

  it("toggleLink flips visibility", async () => {
    await actions.toggleLink("l1", false);
    expect(lastWrite("links", "update")).toEqual([{ is_visible: true }]);
  });

  it("deleteLink deletes by id", async () => {
    await actions.deleteLink("l1");
    expect(lastWrite("links", "delete")).toEqual([]);
    expect(lastWrite("links", "eq")).toEqual(["id", "l1"]);
    expect(db.storage.remove).not.toHaveBeenCalled();
    expect(updateTag).toHaveBeenCalledWith("profile:ethan");
  });

  it("deleteLink also removes the link's picture and screenshot", async () => {
    signedIn({
      links: [
        {
          data: {
            image_url: `${IMAGES}u1/a.jpg`,
            preview_url: `${IMAGES}u1/preview-b.jpeg`,
          },
        },
      ],
    });
    await actions.deleteLink("l1");
    expect(db.storage.from).toHaveBeenCalledWith("link-images");
    expect(db.storage.remove).toHaveBeenCalledWith(["u1/a.jpg"]);
    expect(db.storage.remove).toHaveBeenCalledWith(["u1/preview-b.jpeg"]);
  });
});

describe("updateLink", () => {
  const edit = (fields: Record<string, string>) =>
    actions.updateLink("l1", {}, form(fields));

  it("checks the fields before touching the database", async () => {
    db = fakeClient();
    expect(await edit({ title: "", url: "https://a.com" })).toEqual({
      error: "Add a title and a URL.",
    });
    checkLinkUrl.mockResolvedValueOnce("unsafe!");
    expect(await edit({ title: "x", url: "https://bad.com" })).toEqual({
      error: "unsafe!",
    });
    expect(db.from).not.toHaveBeenCalled();
  });

  it("refuses a picture from someone else's folder", async () => {
    signedIn();
    expect(
      await edit({ title: "x", url: "https://a.com", image_url: `${IMAGES}u2/a.jpg` }),
    ).toEqual({ error: "Could not use that picture. Upload it again." });
  });

  it("refuses links the user doesn't own", async () => {
    signedIn({ links: [{ data: null }] });
    expect(await edit({ title: "x", url: "https://a.com" })).toEqual({
      error: "That link no longer exists.",
    });
    const read = db.queries.links[0].calls;
    expect(read).toContainEqual({ method: "eq", args: ["profile_id", "p1"] });
    expect(lastWrite("links", "update")).toBeUndefined();
  });

  it("saves every field in place and keeps an unchanged picture", async () => {
    signedIn({
      links: [{ data: { image_url: `${IMAGES}u1/a.jpg` } }, { error: null }],
    });
    expect(
      await edit({
        title: " New ",
        url: "example.com",
        size: "big",
        image_url: `${IMAGES}u1/a.jpg`,
        starts_at: "2026-10-14T10:00:00Z",
      }),
    ).toEqual({ saved: true });
    expect(lastWrite("links", "update")).toEqual([
      {
        title: "New",
        url: "https://example.com",
        embed: false,
        size: "big",
        image_url: `${IMAGES}u1/a.jpg`,
        preview_url: null,
        starts_at: "2026-10-14T10:00:00.000Z",
        ends_at: null,
      },
    ]);
    expect(fetchPreviewImage).not.toHaveBeenCalled();
    const write = db.queries.links[1].calls;
    expect(write).toContainEqual({ method: "eq", args: ["id", "l1"] });
    expect(write).toContainEqual({ method: "eq", args: ["profile_id", "p1"] });
    expect(db.storage.remove).not.toHaveBeenCalled();
    expect(updateTag).toHaveBeenCalledWith("profile:ethan");
  });

  it("removes the old picture when it changes", async () => {
    signedIn({
      links: [{ data: { image_url: `${IMAGES}u1/old.jpg` } }, { error: null }],
    });
    await edit({ title: "x", url: "https://a.com", image_url: "" });
    expect(lastWrite("links", "update")?.[0]).toMatchObject({
      image_url: null,
    });
    expect(db.storage.remove).toHaveBeenCalledWith(["u1/old.jpg"]);
  });

  it("keeps the saved preview while the URL stays the same", async () => {
    const saved = { url: "https://a.com", image_url: null, preview_url: "https://p/1.jpg" };
    signedIn({ links: [{ data: saved }, { error: null }] });
    await edit({ title: "x", url: "https://a.com", size: "big" });
    expect(fetchPreviewImage).not.toHaveBeenCalled();
    expect(lastWrite("links", "update")?.[0]).toMatchObject({
      preview_url: "https://p/1.jpg",
    });
  });

  it("looks up a new preview when the URL changes", async () => {
    const saved = { url: "https://a.com", image_url: null, preview_url: "https://p/1.jpg" };
    signedIn({ links: [{ data: saved }, { error: null }] });
    fetchPreviewImage.mockResolvedValueOnce("https://p/2.jpg");
    await edit({ title: "x", url: "https://b.com", size: "big" });
    expect(fetchPreviewImage).toHaveBeenCalledWith("https://b.com");
    expect(lastWrite("links", "update")?.[0]).toMatchObject({
      preview_url: "https://p/2.jpg",
    });
  });

  it("removes an old screenshot when the URL changes", async () => {
    const saved = { url: "https://a.com", image_url: null, preview_url: `${IMAGES}u1/preview-old.jpeg` };
    signedIn({ links: [{ data: saved }, { error: null }] });
    fetchPreviewImage.mockResolvedValueOnce("https://p/new.jpg");
    await edit({ title: "x", url: "https://b.com", size: "big" });
    expect(db.storage.remove).toHaveBeenCalledWith(["u1/preview-old.jpeg"]);
  });

  it("drops the old preview when a small link changes URL", async () => {
    const saved = { url: "https://a.com", image_url: null, preview_url: "https://p/1.jpg" };
    signedIn({ links: [{ data: saved }, { error: null }] });
    await edit({ title: "x", url: "https://b.com" });
    expect(fetchPreviewImage).not.toHaveBeenCalled();
    expect(lastWrite("links", "update")?.[0]).toMatchObject({
      preview_url: null,
    });
  });

  it("leaves pictures it doesn't host alone", async () => {
    signedIn({
      links: [{ data: { image_url: "https://elsewhere/a.jpg" } }, { error: null }],
    });
    await edit({ title: "x", url: "https://a.com" });
    expect(db.storage.remove).not.toHaveBeenCalled();
  });

  it("reports a failed save", async () => {
    signedIn({ links: [{ data: { image_url: null } }, { error: { message: "x" } }] });
    expect(await edit({ title: "x", url: "https://a.com" })).toEqual({
      error: "Could not save the link.",
    });
  });
});

describe("reorderLinks", () => {
  const own = { data: [{ id: "a" }, { id: "b" }, { id: "c" }] };

  it("saves the new positions", async () => {
    signedIn({ links: [own] });
    await actions.reorderLinks(["c", "a", "b"]);
    const updates = db.queries.links
      .slice(1)
      .map((q) => [q.calls[0].args[0], q.calls[1].args[1]]);
    expect(updates).toEqual([
      [{ position: 0 }, "c"],
      [{ position: 1 }, "a"],
      [{ position: 2 }, "b"],
    ]);
  });

  it.each([
    ["someone else's link", ["a", "b", "x"]],
    ["a missing link", ["a", "b"]],
    ["a duplicate", ["a", "a", "b"]],
    ["an extra link", ["a", "b", "c", "x"]],
  ])("changes nothing when the list has %s", async (_label, ids) => {
    signedIn({ links: [own] });
    await actions.reorderLinks(ids);
    expect(db.queries.links).toHaveLength(1);
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("changes nothing when links can't be read", async () => {
    signedIn({ links: [{ data: null }] });
    await actions.reorderLinks([]);
    expect(db.queries.links).toHaveLength(1);
  });
});

describe("setTheme", () => {
  it.each(["neon", "toString", "__proto__"])(
    "ignores unknown theme %s",
    async (theme) => {
      db = fakeClient();
      await actions.setTheme(theme);
      expect(db.from).not.toHaveBeenCalled();
    },
  );

  it("saves a preset", async () => {
    signedIn();
    await actions.setTheme("sunset");
    expect(lastWrite("profiles", "update")).toEqual([
      { theme: { preset: "sunset" } },
    ]);
  });
});

describe("updateSocials", () => {
  it("saves normalized socials and checks web links", async () => {
    signedIn();
    expect(
      await actions.updateSocials(
        {},
        form({ instagram: "@ethan", email: "a@b.co", x: "" }),
      ),
    ).toEqual({ saved: true });
    expect(lastWrite("profiles", "update")).toEqual([
      {
        socials: {
          instagram: "https://instagram.com/ethan",
          email: "mailto:a@b.co",
        },
      },
    ]);
    expect(checkLinkUrl).toHaveBeenCalledTimes(1);
    expect(checkLinkUrl).toHaveBeenCalledWith("https://instagram.com/ethan");
  });

  it("returns the first input error", async () => {
    db = fakeClient();
    expect(
      await actions.updateSocials({}, form({ github: "bad handle" })),
    ).toEqual({ error: "GitHub: use a handle like @name or a full URL." });
  });

  it("refuses an unsafe social URL", async () => {
    db = fakeClient();
    checkLinkUrl.mockResolvedValueOnce("Use a public website address");
    expect(
      await actions.updateSocials({}, form({ x: "http://localhost/x" })),
    ).toEqual({ error: "Use a public website address" });
  });

  it("reports a failed save", async () => {
    signedIn({ profiles: [{ error: { message: "x" } }] });
    expect(await actions.updateSocials({}, form({}))).toEqual({
      error: "Could not save. Try again.",
    });
  });
});

describe("setAvatar", () => {
  it("accepts a picture in the user's own folder and removes the old one", async () => {
    PROFILE.avatar_url = `${AVATARS}u1/old.png`;
    signedIn();
    await actions.setAvatar(`${AVATARS}u1/new.png`);
    expect(lastWrite("profiles", "update")).toEqual([
      { avatar_url: `${AVATARS}u1/new.png` },
    ]);
    expect(db.storage.from).toHaveBeenCalledWith("avatars");
    expect(db.storage.remove).toHaveBeenCalledWith(["u1/old.png"]);
  });

  it.each([
    ["another user's folder", `${AVATARS}u2/pic.png`],
    ["a folder that only starts like the user id", `${AVATARS}u10/pic.png`],
    ["an outside site", "https://evil.example/u1/pic.png"],
  ])("refuses %s", async (_label, url) => {
    signedIn();
    await actions.setAvatar(url);
    expect(lastWrite("profiles", "update")).toBeUndefined();
    expect(db.storage.remove).not.toHaveBeenCalled();
  });

  it("can remove the picture", async () => {
    PROFILE.avatar_url = `${AVATARS}u1/old.png`;
    signedIn();
    await actions.setAvatar(null);
    expect(lastWrite("profiles", "update")).toEqual([{ avatar_url: null }]);
    expect(db.storage.remove).toHaveBeenCalledWith(["u1/old.png"]);
  });

  it("never deletes files outside the avatars bucket", async () => {
    PROFILE.avatar_url = "https://lh3.googleusercontent.com/me.png";
    signedIn();
    await actions.setAvatar(null);
    expect(db.storage.remove).not.toHaveBeenCalled();
  });
});

describe("signOut", () => {
  it("signs out and goes home", async () => {
    db = fakeClient();
    await expect(actions.signOut()).rejects.toMatchObject({ to: "/" });
    expect(db.auth.signOut).toHaveBeenCalled();
  });
});
