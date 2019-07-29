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
    console.log("from createBytes32 in helper.ts", "0".repeat(multiple) + str);
    return "0".repeat(multiple) + str;
}
