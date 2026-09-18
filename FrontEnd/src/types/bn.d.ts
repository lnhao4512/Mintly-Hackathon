declare module "bn.js" {
  export default class BN {
    constructor(number: number | string | number[] | Uint8Array | Buffer | BN, base?: number | "hex", endian?: "le" | "be");
    toNumber(): number;
    toString(base?: number | "hex", length?: number): string;
    toArrayLike(ArrayType: typeof Uint8Array | typeof Buffer, endian?: "le" | "be", length?: number): Uint8Array;
    toArray(endian?: "le" | "be", length?: number): number[];
    toBuffer(endian?: "le" | "be", length?: number): Buffer;
    add(b: BN): BN;
    sub(b: BN): BN;
    mul(b: BN): BN;
    div(b: BN): BN;
    eq(b: BN): boolean;
    gt(b: BN): boolean;
    gte(b: BN): boolean;
    lt(b: BN): boolean;
    lte(b: BN): boolean;
  }
}
