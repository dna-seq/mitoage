/** SeaLifeBase (pinned parquet snapshot v26.06, CC BY-NC 4.0): same schema and reader as FishBase. */
import { loadFishBaseLike } from "./fishbase";
import { SEALIFEBASE } from "./pinned";

export const loadSeaLifeBase = () => loadFishBaseLike(SEALIFEBASE, "SeaLifeBase");
