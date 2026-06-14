export const cosineSimilarity = (a: number[], b: number[]): number => {

    if (a.length !== b.length) throw new Error("Vectors must have same dimension");
    if (a.length === 0) throw new Error("Vectors cannot be empty");

    const dotProduct = a.reduce((acc, val, i) => acc + val * b[i], 0);
    const normA = Math.sqrt(a.reduce((acc, val) => acc + val * val, 0));
    const normB = Math.sqrt(b.reduce((acc, val) => acc + val * val, 0));

    if (normA === 0 || normB === 0)
        throw new Error("Vectors cannot be zero");

    return dotProduct / (normA * normB);

}