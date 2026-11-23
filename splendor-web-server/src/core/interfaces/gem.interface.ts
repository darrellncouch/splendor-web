import { GemColor } from "../types/gem-color.type";
import { GemName } from "../types/gem-name.type";

export interface IGem {
    id: GemColor;
    name: GemName;
    imgUrl: string;
}
