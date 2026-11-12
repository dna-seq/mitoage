/**
 * Client-side loader for /tree/tree.json. One fetch per page, shared by every island that
 * needs it (radial tree, clade scatter, clade species table). Safe for islands.
 */
import { href } from "~/lib/url";
import { decodeTree, type TreeModel, type TreePayload } from "./types";

/** Public path of the compact taxonomy payload (src/pages/tree/tree.json.ts). */
export const TREE_DATA_URL = href("/tree/tree.json");

let pending: Promise<TreeModel> | null = null;

export const loadTree = (url: string = TREE_DATA_URL): Promise<TreeModel> => {
  if (!pending) {
    pending = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`tree data ${r.status}`);
        return r.json() as Promise<TreePayload>;
      })
      .then(decodeTree)
      .catch((e: unknown) => {
        pending = null;
        throw e;
      });
  }
  return pending;
};

/** /tree/ focused on a clade, e.g. treeUrl("order:primates"). */
export const treeUrl = (focusKey?: string): string =>
  href(focusKey ? `/tree/?focus=${encodeURIComponent(focusKey).replace(/%3A/gi, ":")}` : "/tree/");
