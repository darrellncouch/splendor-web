import { IResource } from "./resource.interface";

export interface INoble {
    id: number;
    prestige: number;
    cost: Array<IResource>;
    imgUrl: string;
}