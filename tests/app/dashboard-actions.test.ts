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
const PROFILE = {
  id: "p1",
  username: "ethan",
  avatar_url: null as string | null,
  theme: {} as unknown,
};
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
  PROFILE.theme = {};
});

describe("signed-out users", () => {
  beforeEach(() => {
    db = fakeClient();
  });

  it.each([
    ["updateProfile", () => actions.updateProfile({}, form({}))],
    ["deleteLink", () => actions.deleteLink("l1")],
    ["toggleLink", () => actions.toggleLink("l1", true)],
    ["toggleEmbed", () => actions.toggleEmbed("l1", true)],
    ["reorderLinks", () => actions.reorderLinks([])],
    ["setTheme", () => actions.setTheme("midnight")],
    ["setFont", () => actions.setFont("elegant")],
    ["setCorners", () => actions.setCorners("pill")],
    ["setAvatar", () => actions.setAvatar(null)],
    ["setPhotoStyle", () => actions.setPhotoStyle("cover")],
    [
      "claimUsername",
      () => actions.claimUsername({}, form({ username: "ethan" })),
    ],
    [
      "updateLink",
      () =>
        actions.updateLink(
          "l1",
          {},
          form({ title: "a", url: "https://a.com" }),
        ),
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
    expect(
      await actions.claimUsername({}, form({ username: "admin" })),
    ).toEqual({
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
    expect(
      await actions.claimUsername({}, form({ username: "ethan" })),
    ).toEqual({
      error: message,
    });
  });
});

describe("updateProfile", () => {
  it("caps the name and only updates the user's own row", async () => {
    signedIn();
    expect(
      await actions.updateProfile(
        {},
        form({ display_name: "n".repeat(100), bio: "Hi <b>there</b>" }),
      ),
    ).toEqual({ saved: true });
    expect(lastWrite("profiles", "update")).toEqual([
      { display_name: "n".repeat(60), bio: "Hi <b>there</b>" },
    ]);
    expect(lastWrite("profiles", "eq")).toEqual(["id", "p1"]);
    expect(updateTag).toHaveBeenCalledWith("profile:ethan");
  });

  it("handles missing fields", async () => {
    signedIn();
    await actions.updateProfile({}, form({}));
    expect(lastWrite("profiles", "update")).toEqual([
      { display_name: "", bio: "" },
    ]);
  });

  it("stores unknown tags as text", async () => {
    signedIn();
    await actions.updateProfile(
      {},
      form({ bio: '<img src=x onerror="alert(1)">' }),
    );
    expect(lastWrite("profiles", "update")).toEqual([
      {
        display_name: "",
        bio: "&lt;img src=x onerror=\"alert(1)\"&gt;",
      },
    ]);
  });

  it("refuses bios over 160 visible characters", async () => {
    db = fakeClient();
    expect(
      await actions.updateProfile({}, form({ bio: `<b>${"b".repeat(161)}</b>` })),
    ).toEqual({ error: "Keep your bio under 160 characters." });
    expect(db.from).not.toHaveBeenCalled();
  });

  it("checks every link in the bio", async () => {
    checkLinkUrl.mockResolvedValueOnce(null).mockResolvedValueOnce("unsafe!");
    db = fakeClient();
    expect(
      await actions.updateProfile(
        {},
        form({ bio: '<a href="https://a.com">a</a> <a href="b.com">b</a>' }),
      ),
    ).toEqual({ error: "Link in your bio: unsafe!" });
    expect(checkLinkUrl).toHaveBeenCalledWith("https://b.com/");
    expect(db.from).not.toHaveBeenCalled();
  });

  it("reports a failed save", async () => {
    signedIn({ profiles: [{ error: { message: "check" } }] });
    expect(await actions.updateProfile({}, form({ bio: "hi" }))).toEqual({
      error: "Could not save. Try again.",
    });
    expect(updateTag).not.toHaveBeenCalled();
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
      await actions.addLink(
        {},
        form({ title: "x", url: "javascript:alert(1)" }),
      ),
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

  it("saves the preview the user chose", async () => {
    signedIn({ links: [{ count: 0 }, { error: null }] });
    await actions.addLink(
      {},
      form({
        title: "x",
        url: "https://a.com",
        size: "big",
        preview_url: `${IMAGES}u1/preview-a.jpeg`,
      }),
    );
    expect(lastWrite("links", "insert")?.[0]).toMatchObject({
      preview_url: `${IMAGES}u1/preview-a.jpeg`,
    });
  });

  it("refuses a preview from someone else's folder or not on https", async () => {
    for (const preview_url of [
      `${IMAGES}u2/preview-a.jpeg`,
      "http://a.com/og.jpg",
    ]) {
      signedIn();
      expect(
        await actions.addLink(
          {},
          form({ title: "x", url: "https://a.com", size: "big", preview_url }),
        ),
      ).toEqual({ error: "Could not use that picture. Upload it again." });
    }
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

  it("deleteLink on a gallery removes its photo files from the user's folder", async () => {
    signedIn({
      links: [{ data: { image_url: null, preview_url: null } }, {}],
      photos: [
        {
          data: [
            {
              url: "https://x.supabase.co/storage/v1/object/public/photos/u1/a.jpg",
            },
            {
              url: "https://x.supabase.co/storage/v1/object/public/photos/u2/b.jpg",
            },
          ],
        },
      ],
    });
    await actions.deleteLink("g1");
    expect(db.queries.photos[0].calls).toContainEqual({
      method: "eq",
      args: ["link_id", "g1"],
    });
    expect(db.storage.from).toHaveBeenCalledWith("photos");
    expect(db.storage.remove).toHaveBeenCalledWith(["u1/a.jpg"]);
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
      await edit({
        title: "x",
        url: "https://a.com",
        image_url: `${IMAGES}u2/a.jpg`,
      }),
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

  it("saves the preview the form sends", async () => {
    const saved = {
      url: "https://a.com",
      image_url: null,
      preview_url: "https://p/1.jpg",
    };
    signedIn({ links: [{ data: saved }, { error: null }] });
    await edit({
      title: "x",
      url: "https://a.com",
      size: "big",
      preview_url: "https://p/1.jpg",
    });
    expect(lastWrite("links", "update")?.[0]).toMatchObject({
      preview_url: "https://p/1.jpg",
    });
    expect(db.storage.remove).not.toHaveBeenCalled();
  });

  it("removes an old screenshot when the preview changes or is dropped", async () => {
    const saved = {
      url: "https://a.com",
      image_url: null,
      preview_url: `${IMAGES}u1/preview-old.jpeg`,
    };
    signedIn({ links: [{ data: saved }, { error: null }] });
    await edit({ title: "x", url: "https://b.com", size: "big" });
    expect(lastWrite("links", "update")?.[0]).toMatchObject({
      preview_url: null,
    });
    expect(db.storage.remove).toHaveBeenCalledWith(["u1/preview-old.jpeg"]);
  });

  it("leaves pictures it doesn't host alone", async () => {
    signedIn({
      links: [
        { data: { image_url: "https://elsewhere/a.jpg" } },
        { error: null },
      ],
    });
    await edit({ title: "x", url: "https://a.com" });
    expect(db.storage.remove).not.toHaveBeenCalled();
  });

  it("reports a failed save", async () => {
    signedIn({
      links: [{ data: { image_url: null } }, { error: { message: "x" } }],
    });
    expect(await edit({ title: "x", url: "https://a.com" })).toEqual({
      error: "Could not save the link.",
    });
  });
});

describe("loadPreview", () => {
  it("needs a safe URL", async () => {
    db = fakeClient();
    expect(await actions.loadPreview("  ")).toEqual({
      error: "Add the URL first.",
    });
    checkLinkUrl.mockResolvedValueOnce("unsafe!");
    expect(await actions.loadPreview("bad.com")).toEqual({ error: "unsafe!" });
    expect(checkLinkUrl).toHaveBeenCalledWith("https://bad.com");
    expect(db.from).not.toHaveBeenCalled();
  });

  it("is rate-limited", async () => {
    signedIn();
    allow.mockResolvedValueOnce(false);
    expect(await actions.loadPreview("https://a.com")).toEqual({
      error: "Too many previews. Wait a few minutes.",
    });
    expect(fetchPreviewImage).not.toHaveBeenCalled();
  });

  it("uses the page's share picture", async () => {
    signedIn();
    fetchPreviewImage.mockResolvedValueOnce("https://cdn.a.com/og.jpg");
    expect(await actions.loadPreview("https://a.com")).toEqual({
      preview_url: "https://cdn.a.com/og.jpg",
    });
    expect(fetchScreenshot).not.toHaveBeenCalled();
  });

  it("saves a screenshot when the page has no share picture", async () => {
    signedIn();
    const data = new ArrayBuffer(8);
    fetchScreenshot.mockResolvedValueOnce({ data, type: "image/jpeg" });
    const result = await actions.loadPreview("https://a.com");
    const [path, body, opts] = db.storage.upload.mock.calls[0];
    expect(path).toMatch(/^u1\/preview-[\w-]+\.jpeg$/);
    expect(body).toBe(data);
    expect(opts).toEqual({ contentType: "image/jpeg" });
    expect(result).toEqual({ preview_url: `${IMAGES}${path}` });
  });

  it("falls back to the site icon, then to an error", async () => {
    signedIn();
    const icon = "https://a.com/i.svg#biolyn-icon";
    fetchPreviewImage.mockResolvedValueOnce(icon);
    fetchScreenshot.mockResolvedValueOnce({
      data: new ArrayBuffer(8),
      type: "image/png",
    });
    db.storage.upload.mockResolvedValueOnce({
      data: null,
      error: { message: "x" },
    });
    expect(await actions.loadPreview("https://a.com")).toEqual({
      preview_url: icon,
    });

    const none = {
      error: "Could not find a preview for this link. Add a picture instead.",
    };
    signedIn();
    expect(await actions.loadPreview("https://a.com")).toEqual(none);
    signedIn();
    fetchPreviewImage.mockRejectedValueOnce(new Error("boom"));
    expect(await actions.loadPreview("https://a.com")).toEqual(none);
  });
});

describe("discardLinkImage", () => {
  it("deletes an unused picture in the user's folder", async () => {
    signedIn({ links: [{ count: 0 }] });
    await actions.discardLinkImage(`${IMAGES}u1/preview-a.jpeg`);
    expect(db.storage.remove).toHaveBeenCalledWith(["u1/preview-a.jpeg"]);
  });

  it("keeps pictures a saved link uses, and anything not the user's", async () => {
    signedIn({ links: [{ count: 0 }, { count: 1 }] });
    await actions.discardLinkImage(`${IMAGES}u1/a.jpg`);
    expect(db.storage.remove).not.toHaveBeenCalled();
    for (const url of [`${IMAGES}u2/a.jpg`, "https://cdn.a.com/og.jpg"]) {
      signedIn();
      await actions.discardLinkImage(url);
      expect(db.storage.remove).not.toHaveBeenCalled();
    }
    expect(db.storage.remove).not.toHaveBeenCalled();
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
  it("keeps the picture style", async () => {
    PROFILE.theme = { preset: "classic", photo: "cover" };
    signedIn();
    await actions.setTheme("midnight");
    expect(lastWrite("profiles", "update")).toEqual([
      { theme: { preset: "midnight", photo: "cover" } },
    ]);
  });

  it("keeps the chosen font", async () => {
    db = fakeClient({
      profiles: [{ data: { ...PROFILE, theme: { preset: "classic", font: "typewriter" } } }, { error: null }],
    });
    db.auth.getUser.mockResolvedValue({ data: { user: USER } } as never);
    await actions.setTheme("midnight");
    expect(lastWrite("profiles", "update")).toEqual([
      { theme: { preset: "midnight", font: "typewriter" } },
    ]);
  });
});

describe("setCorners", () => {
  it.each(["sharp", "toString", ""])(
    "ignores unknown corners %s",
    async (corners) => {
      db = fakeClient();
      await actions.setCorners(corners);
      expect(db.from).not.toHaveBeenCalled();
    },
  );

  it("saves the corners and keeps the font and theme", async () => {
    db = fakeClient({
      profiles: [
        { data: { ...PROFILE, theme: { preset: "sunset", font: "elegant" } } },
        { error: null },
      ],
    });
    db.auth.getUser.mockResolvedValue({ data: { user: USER } } as never);
    await actions.setCorners("pill");
    expect(lastWrite("profiles", "update")).toEqual([
      { theme: { preset: "sunset", font: "elegant", corners: "pill" } },
    ]);
    expect(lastWrite("profiles", "eq")).toEqual(["id", "p1"]);
  });
});

describe("setFont", () => {
  it.each(["comic-sans", "toString", ""])(
    "ignores unknown font %s",
    async (font) => {
      db = fakeClient();
      await actions.setFont(font);
      expect(db.from).not.toHaveBeenCalled();
    },
  );

  it("saves the font and keeps the theme", async () => {
    db = fakeClient({
      profiles: [{ data: { ...PROFILE, theme: { preset: "sunset" } } }, { error: null }],
    });
    db.auth.getUser.mockResolvedValue({ data: { user: USER } } as never);
    await actions.setFont("handwritten");
    expect(lastWrite("profiles", "update")).toEqual([
      { theme: { preset: "sunset", font: "handwritten" } },
    ]);
    expect(lastWrite("profiles", "eq")).toEqual(["id", "p1"]);
  });
});

describe("setPhotoStyle", () => {
  it.each(["square", "toString", ""])(
    "ignores unknown style %s",
    async (style) => {
      db = fakeClient();
      await actions.setPhotoStyle(style);
      expect(db.from).not.toHaveBeenCalled();
    },
  );

  it("saves the style and keeps the theme", async () => {
    PROFILE.theme = { preset: "sunset" };
    signedIn();
    await actions.setPhotoStyle("cover");
    expect(lastWrite("profiles", "update")).toEqual([
      { theme: { preset: "sunset", photo: "cover" } },
    ]);
    expect(updateTag).toHaveBeenCalledWith("profile:ethan");
  });

  it("works on a page that never saved a theme", async () => {
    PROFILE.theme = null;
    signedIn();
    await actions.setPhotoStyle("round");
    expect(lastWrite("profiles", "update")).toEqual([
      { theme: { photo: "round" } },
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

const PHOTOS = "https://x.supabase.co/storage/v1/object/public/photos/";
const GALLERY = { data: { id: "g1" } };

describe("photo actions when signed out", () => {
  beforeEach(() => {
    db = fakeClient();
  });

  it.each([
    ["addGallery", () => actions.addGallery()],
    ["addPhoto", () => actions.addPhoto("g1", `${PHOTOS}u1/a.jpg`, "")],
    ["updatePhotoAlt", () => actions.updatePhotoAlt("ph1", "x")],
    ["deletePhoto", () => actions.deletePhoto("ph1")],
    ["reorderPhotos", () => actions.reorderPhotos("g1", [])],
    ["setGalleryLayout", () => actions.setGalleryLayout("g1", "grid")],
  ])("%s sends them to login and writes nothing", async (_name, run) => {
    await expect(run()).rejects.toMatchObject({ to: "/login" });
    expect(db.from).not.toHaveBeenCalledWith("photos");
    expect(db.from).not.toHaveBeenCalledWith("links");
    expect(db.storage.remove).not.toHaveBeenCalled();
  });
});

describe("addGallery", () => {
  it("adds an empty carousel at the end of the list", async () => {
    signedIn({
      links: [{ data: [{ kind: "link" }, { kind: "gallery" }] }, {}],
    });
    expect(await actions.addGallery()).toEqual({});
    expect(lastWrite("links", "insert")).toEqual([
      {
        profile_id: "p1",
        title: "Photos",
        kind: "gallery",
        layout: "carousel",
        position: 2,
      },
    ]);
    expect(allow).toHaveBeenCalledWith("addlink:p1", 30, 600);
    expect(updateTag).toHaveBeenCalledWith("profile:ethan");
  });

  it("stops at 5 galleries", async () => {
    signedIn({ links: [{ data: Array(5).fill({ kind: "gallery" }) }] });
    expect(await actions.addGallery()).toEqual({
      error: "You can have up to 5 photo galleries.",
    });
    expect(lastWrite("links", "insert")).toBeUndefined();
  });

  it("counts galleries toward the item limit", async () => {
    signedIn({ links: [{ data: Array(100).fill({ kind: "link" }) }] });
    expect((await actions.addGallery()).error).toMatch(/up to \d+ items/);
    expect(lastWrite("links", "insert")).toBeUndefined();
  });

  it("rate limits", async () => {
    allow.mockResolvedValue(false);
    signedIn();
    expect((await actions.addGallery()).error).toMatch(/very fast/);
    expect(db.from).not.toHaveBeenCalledWith("links");
  });

  it("reports a failed save", async () => {
    signedIn({ links: [{ data: null }, { error: { code: "x" } }] });
    expect(await actions.addGallery()).toEqual({
      error: "Could not add the gallery.",
    });
  });
});

describe("addPhoto", () => {
  it("saves a photo from the user's own folder at the end of its gallery", async () => {
    signedIn({
      links: [GALLERY],
      photos: [
        { data: [{ link_id: "g1" }, { link_id: "g1" }, { link_id: "g2" }] },
        { error: null },
      ],
    });
    expect(
      await actions.addPhoto("g1", `${PHOTOS}u1/a.jpg`, "  My   dog "),
    ).toEqual({});
    expect(db.queries.links[0].calls).toContainEqual({
      method: "eq",
      args: ["kind", "gallery"],
    });
    expect(lastWrite("photos", "insert")).toEqual([
      {
        profile_id: "p1",
        link_id: "g1",
        url: `${PHOTOS}u1/a.jpg`,
        alt: "My dog",
        position: 2,
      },
    ]);
    expect(allow).toHaveBeenCalledWith("addphoto:p1", 30, 600);
    expect(updateTag).toHaveBeenCalledWith("profile:ethan");
  });

  it.each([
    ["another user's folder", `${PHOTOS}u2/a.jpg`],
    ["an outside site", "https://evil.example/u1/a.jpg"],
  ])("refuses %s and deletes nothing", async (_label, url) => {
    signedIn();
    expect(await actions.addPhoto("g1", url, "")).toEqual({
      error: "Could not add that photo.",
    });
    expect(db.from).not.toHaveBeenCalledWith("photos");
    expect(db.storage.remove).not.toHaveBeenCalled();
  });

  it("refuses a gallery that isn't theirs and removes the upload", async () => {
    signedIn({ links: [{ data: null }] });
    expect(await actions.addPhoto("g9", `${PHOTOS}u1/a.jpg`, "")).toEqual({
      error: "That gallery no longer exists.",
    });
    expect(db.from).not.toHaveBeenCalledWith("photos");
    expect(db.storage.remove).toHaveBeenCalledWith(["u1/a.jpg"]);
  });

  it("stops at 12 photos in a gallery and removes the extra upload", async () => {
    signedIn({
      links: [GALLERY],
      photos: [{ data: Array(12).fill({ link_id: "g1" }) }],
    });
    expect(await actions.addPhoto("g1", `${PHOTOS}u1/a.jpg`, "")).toEqual({
      error: "A gallery can have up to 12 photos.",
    });
    expect(lastWrite("photos", "insert")).toBeUndefined();
    expect(db.storage.from).toHaveBeenCalledWith("photos");
    expect(db.storage.remove).toHaveBeenCalledWith(["u1/a.jpg"]);
  });

  it("stops at 60 photos on the page", async () => {
    signedIn({
      links: [GALLERY],
      photos: [{ data: Array(60).fill({ link_id: "g2" }) }],
    });
    expect(await actions.addPhoto("g1", `${PHOTOS}u1/a.jpg`, "")).toEqual({
      error: "Your page can have up to 60 photos.",
    });
    expect(db.storage.remove).toHaveBeenCalledWith(["u1/a.jpg"]);
  });

  it("rate limits and removes the upload", async () => {
    allow.mockResolvedValue(false);
    signedIn({ links: [GALLERY] });
    expect(await actions.addPhoto("g1", `${PHOTOS}u1/a.jpg`, "")).toEqual({
      error: "You're adding photos very fast. Wait a few minutes.",
    });
    expect(db.storage.remove).toHaveBeenCalledWith(["u1/a.jpg"]);
  });

  it("removes the upload when the row can't be saved", async () => {
    signedIn({
      links: [GALLERY],
      photos: [{ data: null }, { error: { code: "P0001" } }],
    });
    expect(await actions.addPhoto("g1", `${PHOTOS}u1/a.jpg`, "")).toEqual({
      error: "Could not save the photo.",
    });
    expect(lastWrite("photos", "insert")?.[0]).toMatchObject({ position: 0 });
    expect(db.storage.remove).toHaveBeenCalledWith(["u1/a.jpg"]);
  });
});

describe("updatePhotoAlt", () => {
  it("cleans the text and only touches the user's own photo", async () => {
    signedIn();
    await actions.updatePhotoAlt("ph1", "  Sunset \n at sea ");
    expect(lastWrite("photos", "update")).toEqual([{ alt: "Sunset at sea" }]);
    expect(db.queries.photos[0].calls).toContainEqual({
      method: "eq",
      args: ["profile_id", "p1"],
    });
  });
});

describe("deletePhoto", () => {
  it("deletes the row and the file", async () => {
    signedIn({
      photos: [{ data: { id: "ph1", url: `${PHOTOS}u1/a.jpg` } }, {}],
    });
    await actions.deletePhoto("ph1");
    expect(db.queries.photos[0].calls).toContainEqual({
      method: "eq",
      args: ["profile_id", "p1"],
    });
    expect(lastWrite("photos", "delete")).toEqual([]);
    expect(db.storage.remove).toHaveBeenCalledWith(["u1/a.jpg"]);
    expect(updateTag).toHaveBeenCalledWith("profile:ethan");
  });

  it("does nothing for a photo that isn't theirs", async () => {
    signedIn({ photos: [{ data: null }] });
    await actions.deletePhoto("ph9");
    expect(lastWrite("photos", "delete")).toBeUndefined();
    expect(db.storage.remove).not.toHaveBeenCalled();
  });

  it("never deletes files outside the user's folder", async () => {
    signedIn({
      photos: [{ data: { id: "ph1", url: `${PHOTOS}u2/a.jpg` } }, {}],
    });
    await actions.deletePhoto("ph1");
    expect(lastWrite("photos", "delete")).toEqual([]);
    expect(db.storage.remove).not.toHaveBeenCalled();
  });
});

describe("reorderPhotos", () => {
  const own = { data: [{ id: "a" }, { id: "b" }] };

  it("saves the new positions inside one gallery", async () => {
    signedIn({ photos: [own] });
    await actions.reorderPhotos("g1", ["b", "a"]);
    expect(db.queries.photos[0].calls).toContainEqual({
      method: "eq",
      args: ["link_id", "g1"],
    });
    const updates = db.queries.photos
      .slice(1)
      .map((q) => [q.calls[0].args[0], q.calls[1].args[1]]);
    expect(updates).toEqual([
      [{ position: 0 }, "b"],
      [{ position: 1 }, "a"],
    ]);
  });

  it.each([
    ["someone else's photo", ["a", "x"]],
    ["a missing photo", ["a"]],
    ["a repeated photo", ["a", "a"]],
  ])("ignores a list with %s", async (_label, ids) => {
    signedIn({ photos: [own] });
    await actions.reorderPhotos("g1", ids);
    expect(db.queries.photos).toHaveLength(1);
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("does nothing when the photos can't be read", async () => {
    signedIn({ photos: [{ data: null }] });
    await actions.reorderPhotos("g1", ["a"]);
    expect(db.queries.photos).toHaveLength(1);
  });
});

describe("setGalleryLayout", () => {
  it("saves a known layout on the user's own gallery", async () => {
    signedIn();
    await actions.setGalleryLayout("g1", "grid");
    expect(lastWrite("links", "update")).toEqual([{ layout: "grid" }]);
    const filters = db.queries.links[0].calls.filter((c) => c.method === "eq");
    expect(filters.map((c) => c.args)).toEqual([
      ["id", "g1"],
      ["profile_id", "p1"],
      ["kind", "gallery"],
    ]);
  });

  it("ignores anything else without signing in", async () => {
    db = fakeClient();
    await actions.setGalleryLayout("g1", "slideshow");
    expect(db.auth.getUser).not.toHaveBeenCalled();
  });
});

describe("addSource", () => {
  it("checks the form before touching the database", async () => {
    db = fakeClient();
    expect(await actions.addSource({}, form({ label: "" }))).toEqual({
      error: "Give the link a name, like TikTok.",
    });
    expect(db.from).not.toHaveBeenCalled();
  });

  it("saves the name and code for the owner's page", async () => {
    signedIn({ sources: [{ count: 2 }, { error: null }] });
    expect(
      await actions.addSource({}, form({ label: "TikTok bio", code: "" })),
    ).toEqual({ saved: true });
    const insert = db.queries.sources[1].calls.find((c) => c.method === "insert");
    expect(insert?.args[0]).toEqual({
      profile_id: "p1",
      label: "TikTok bio",
      code: "tiktok-bio",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
  });

  it("stops at the limit", async () => {
    signedIn({ sources: [{ count: 20 }] });
    expect(await actions.addSource({}, form({ label: "One more" }))).toEqual({
      error: "You can have up to 20 tracking links.",
    });
  });

  it("explains a code that is already taken", async () => {
    signedIn({ sources: [{ count: 1 }, { error: { code: "23505" } }] });
    expect(await actions.addSource({}, form({ label: "TikTok" }))).toEqual({
      error: 'You already have a link with the code "tiktok".',
    });
  });

  it("reports other database errors", async () => {
    signedIn({ sources: [{ count: null }, { error: { code: "XX000" } }] });
    expect(await actions.addSource({}, form({ label: "TikTok" }))).toEqual({
      error: "Could not save the tracking link.",
    });
  });
});

describe("deleteSource", () => {
  it("only deletes the owner's own source", async () => {
    signedIn({ sources: [{ error: null }] });
    await actions.deleteSource("s1");
    const calls = db.queries.sources[0].calls;
    expect(calls).toContainEqual({ method: "eq", args: ["id", "s1"] });
    expect(calls).toContainEqual({ method: "eq", args: ["profile_id", "p1"] });
  });
});
