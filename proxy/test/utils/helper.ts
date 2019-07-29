export function randomString(length: number) {
    const radom13chars = () => {
        return Math.random().toString(16).substring(2, 15);
    };
    const loops = Math.ceil(length / 13);
    return new Array(loops).fill(radom13chars).reduce((stringg, func) => {
        return stringg + func();
    }, "").substring(0, length);
}

export function createBytes32(str: string) {
    const numberOfSymbolsInBytes32: number = 64;
    const lenght: number = str.length;
    const multiple: number = numberOfSymbolsInBytes32 - lenght;
    //
    // console.log("from createBytes32 in helper.ts", "0".repeat(multiple) + str);
    return "0".repeat(multiple) + str;
}

export function stringToHex(str: string, hex: any) {
    try {
      hex = unescape(encodeURIComponent(str))
      .split("").map((v) => {
        return v.charCodeAt(0).toString(16);
      }).join("");
    } catch (e) {
      hex = str;
      console.log("invalid text input: " + str);
    }
    return hex;
}

export function stringFromHex(hex: string, str: string) {
    try {
      str = decodeURIComponent(hex.replace(/(..)/g, "%$1"));
    } catch (e) {
      str = hex;
      console.log("invalid hex input: " + hex);
    }
    return str;
}
