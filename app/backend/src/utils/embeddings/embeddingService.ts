export class EmbeddingService {
    constructor(
        private readonly model: string,
    ) { }

    public async embed(text: string): Promise<number[]>{
        const embedText = 
    }
    public async embedBatch(texts: string[]): Promise<number[][]> {

    }
    public findMostSimilar(query:number[],candidates:number[][]): { index:number,similarity:number} 




}