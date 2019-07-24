export function randomString(length: number) {
    const radom13chars = () => {
        return Math.random().toString(16).substring(2, 15);
    };
    const loops = Math.ceil(length / 13);
    return new Array(loops).fill(radom13chars).reduce((stringg, func) => {
        return stringg + func();
    }, "").substring(0, length);
}
