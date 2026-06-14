import { describe, it, expect } from 'vitest';
import { cosineSimilarity } from '../similarity.js';

describe('cosineSimilarity', () => {
  it('should return 1 for identical vectors', () => {
    const a = [1, 2, 3];
    const b = [1, 2, 3];
    expect(cosineSimilarity(a, b)).toBeCloseTo(1, 5);
  });

  it('should return -1 for opposite vectors', () => {
    const a = [1, 2, 3];
    const b = [-1, -2, -3];
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1, 5);
  });

  it('should return 0 for orthogonal vectors', () => {
    const a = [1, 0, 0];
    const b = [0, 1, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(0, 5);
  });

  it('should return correct similarity value for arbitrary vectors', () => {
    const a = [3, 4];
    const b = [4, 3];
    // dot = 12 + 12 = 24
    // normA = 5, normB = 5
    // similarity = 24 / 25 = 0.96
    expect(cosineSimilarity(a, b)).toBeCloseTo(0.96, 5);
  });

  it('should throw an error if vectors have different dimensions', () => {
    const a = [1, 2];
    const b = [1, 2, 3];
    expect(() => cosineSimilarity(a, b)).toThrowError('Vectors must have same dimension');
  });

  it('should throw an error if vectors are empty', () => {
    const a: number[] = [];
    const b: number[] = [];
    expect(() => cosineSimilarity(a, b)).toThrowError('Vectors cannot be empty');
  });

  it('should throw an error if a vector is a zero vector', () => {
    const a = [0, 0, 0];
    const b = [1, 2, 3];
    expect(() => cosineSimilarity(a, b)).toThrowError('Vectors cannot be zero');
  });
});
