import { describe, expect, it } from 'vitest';
import { PROJECT_AREAS } from './projectStructure.js';

describe('projectStructure', () => {
  it('documents the new Vite/React working folders', () => {
    expect(PROJECT_AREAS.components).toBe('src/components');
    expect(PROJECT_AREAS.lib).toBe('src/lib');
    expect(PROJECT_AREAS.services).toBe('src/services');
    expect(PROJECT_AREAS.styles).toBe('src/styles');
    expect(PROJECT_AREAS.legacy).toBe('src/legacy');
  });
});
