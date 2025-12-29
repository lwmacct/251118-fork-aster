/**
 * Aster UI Protocol - JSON Pointer Path Resolver Property Tests
 *
 * Feature: aster-ui-protocol
 * Property 6: JSON Pointer Path Resolution
 *
 * Validates: Requirements 3.1, 3.4
 */

import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import {
  isValidJsonPointer,
  parseJsonPointer,
  toJsonPointer,
  decodeJsonPointerToken,
  encodeJsonPointerToken,
  resolvePath,
  getData,
  setData,
  hasPath,
  deleteData,
  getParentPath,
  getLastToken,
  joinPaths,
  PathError,
} from '@/protocol/path-resolver';
import type { DataValue, DataMap } from '@/types/ui-protocol';

// ==================
// Arbitrary Generators
// ==================

/**
 * Generate valid path tokens (no ~ or /, and not reserved JS property names)
 */
const reservedKeys = ['constructor', 'valueOf', 'toString', 'hasOwnProperty', '__proto__', 'prototype'];
const simpleTokenArb = fc.string({ minLength: 1, maxLength: 20 })
  .filter(s => !s.includes('~') && !s.includes('/') && s.length > 0 && !reservedKeys.includes(s));

/**
 * Generate valid JSON Pointer paths
 */
const validJsonPointerArb = fc.oneof(
  fc.constant(''),
  fc.array(simpleTokenArb, { minLength: 1, maxLength: 5 })
    .map(tokens => '/' + tokens.join('/')),
);

/**
 * Generate invalid JSON Pointer paths
 */
const invalidJsonPointerArb = fc.oneof(
  fc.string({ minLength: 1, maxLength: 20 }).filter(s => !s.startsWith('/') && s !== ''),
  fc.constant('invalid'),
  fc.constant('no/leading/slash'),
);

/**
 * Generate simple DataValue (non-recursive)
 */
const simpleDataValueArb: fc.Arbitrary<DataValue> = fc.oneof(
  fc.string(),
  fc.double({ noNaN: true, noDefaultInfinity: true }),
  fc.boolean(),
  fc.constant(null),
);

/**
 * Generate shallow DataMap
 */
const shallowDataMapArb: fc.Arbitrary<DataMap> = fc.dictionary(
  simpleTokenArb,
  simpleDataValueArb,
  { minKeys: 1, maxKeys: 5 },
);

// ==================
// Property Tests
// ==================

describe('JSON Pointer Path Resolver', () => {
  describe('Property 6: JSON Pointer Path Resolution', () => {
    /**
     * Feature: aster-ui-protocol, Property 6: JSON Pointer Path Resolution
     * Validates: Requirements 3.1, 3.4
     *
     * For any valid JSON Pointer path and data model, path resolution should
     * correctly return the data value at that position; for non-existing paths,
     * it should return null or default value.
     */

    describe('isValidJsonPointer', () => {
      it('should accept empty string as valid', () => {
        expect(isValidJsonPointer('')).toBe(true);
      });

      it('should accept paths starting with "/" as valid', () => {
        fc.assert(
          fc.property(validJsonPointerArb, (path) => {
            expect(isValidJsonPointer(path)).toBe(true);
          }),
          { numRuns: 100 },
        );
      });

      it('should reject paths not starting with "/" (except empty)', () => {
        fc.assert(
          fc.property(invalidJsonPointerArb, (path) => {
            expect(isValidJsonPointer(path)).toBe(false);
          }),
          { numRuns: 100 },
        );
      });
    });

    describe('parseJsonPointer / toJsonPointer round-trip', () => {
      it('should round-trip valid JSON Pointers', () => {
        fc.assert(
          fc.property(
            fc.array(simpleTokenArb, { minLength: 0, maxLength: 5 }),
            (tokens) => {
              const pointer = toJsonPointer(tokens);
              const parsed = parseJsonPointer(pointer);
              expect(parsed).toEqual(tokens);
            },
          ),
          { numRuns: 100 },
        );
      });

      it('should handle empty path correctly', () => {
        expect(parseJsonPointer('')).toEqual([]);
        expect(toJsonPointer([])).toBe('');
      });
    });

    describe('encodeJsonPointerToken / decodeJsonPointerToken round-trip', () => {
      it('should round-trip any string through encode/decode', () => {
        fc.assert(
          fc.property(fc.string(), (token) => {
            const encoded = encodeJsonPointerToken(token);
            const decoded = decodeJsonPointerToken(encoded);
            expect(decoded).toBe(token);
          }),
          { numRuns: 100 },
        );
      });

      it('should encode ~ as ~0', () => {
        expect(encodeJsonPointerToken('~')).toBe('~0');
        expect(encodeJsonPointerToken('a~b')).toBe('a~0b');
      });

      it('should encode / as ~1', () => {
        expect(encodeJsonPointerToken('/')).toBe('~1');
        expect(encodeJsonPointerToken('a/b')).toBe('a~1b');
      });

      it('should decode ~0 as ~', () => {
        expect(decodeJsonPointerToken('~0')).toBe('~');
        expect(decodeJsonPointerToken('a~0b')).toBe('a~b');
      });

      it('should decode ~1 as /', () => {
        expect(decodeJsonPointerToken('~1')).toBe('/');
        expect(decodeJsonPointerToken('a~1b')).toBe('a/b');
      });
    });

    describe('getData', () => {
      it('should return entire data for empty path', () => {
        fc.assert(
          fc.property(shallowDataMapArb, (data) => {
            const result = getData(data, '');
            expect(result).toEqual(data);
          }),
          { numRuns: 100 },
        );
      });

      it('should return correct value for existing paths', () => {
        fc.assert(
          fc.property(
            simpleTokenArb,
            simpleDataValueArb,
            (key, value) => {
              const data: DataMap = { [key]: value };
              const result = getData(data, `/${key}`);
              expect(result).toEqual(value);
            },
          ),
          { numRuns: 100 },
        );
      });

      it('should return null for non-existing paths', () => {
        fc.assert(
          fc.property(
            shallowDataMapArb,
            simpleTokenArb.filter(k => k !== ''),
            (data, nonExistingKey) => {
              const safeKey = `__nonexistent_${nonExistingKey}__`;
              const result = getData(data, `/${safeKey}`);
              expect(result).toBeNull();
            },
          ),
          { numRuns: 100 },
        );
      });

      it('should handle array indexing correctly', () => {
        fc.assert(
          fc.property(
            fc.array(simpleDataValueArb, { minLength: 1, maxLength: 5 }),
            (arr) => {
              const data: DataMap = { items: arr };
              for (let i = 0; i < arr.length; i++) {
                const result = getData(data, `/items/${i}`);
                expect(result).toEqual(arr[i]);
              }
            },
          ),
          { numRuns: 100 },
        );
      });

      it('should return null for invalid array indices', () => {
        const data: DataMap = { items: [1, 2, 3] };
        expect(getData(data, '/items/-1')).toBeNull();
        expect(getData(data, '/items/10')).toBeNull();
        expect(getData(data, '/items/abc')).toBeNull();
      });

      it('should return null for invalid paths', () => {
        const data: DataMap = { key: 'value' };
        expect(getData(data, 'invalid')).toBeNull();
      });

      it('should handle nested paths correctly', () => {
        const data: DataMap = {
          user: {
            name: 'Alice',
            address: {
              city: 'Beijing',
            },
          },
        };
        expect(getData(data, '/user/name')).toBe('Alice');
        expect(getData(data, '/user/address/city')).toBe('Beijing');
        expect(getData(data, '/user/address/country')).toBeNull();
      });
    });

    describe('setData', () => {
      it('should set value at existing path', () => {
        fc.assert(
          fc.property(
            simpleTokenArb,
            simpleDataValueArb,
            simpleDataValueArb,
            (key, initialValue, newValue) => {
              const data: DataMap = { [key]: initialValue };
              const result = setData(data, `/${key}`, newValue);
              expect(result).toBe(true);
              expect(data[key]).toEqual(newValue);
            },
          ),
          { numRuns: 100 },
        );
      });

      it('should create new key at non-existing path', () => {
        fc.assert(
          fc.property(
            simpleTokenArb,
            simpleDataValueArb,
            (key, value) => {
              const data: DataMap = {};
              const result = setData(data, `/${key}`, value);
              expect(result).toBe(true);
              expect(data[key]).toEqual(value);
            },
          ),
          { numRuns: 100 },
        );
      });

      it('should return false for empty path', () => {
        const data: DataMap = { key: 'value' };
        expect(setData(data, '', 'newValue')).toBe(false);
      });

      it('should return false for invalid path', () => {
        const data: DataMap = { key: 'value' };
        expect(setData(data, 'invalid', 'newValue')).toBe(false);
      });

      it('should set array element correctly', () => {
        const data: DataMap = { items: [1, 2, 3] };
        expect(setData(data, '/items/1', 'updated')).toBe(true);
        expect((data.items as DataValue[])[1]).toBe('updated');
      });

      it('should allow appending to array', () => {
        const data: DataMap = { items: [1, 2, 3] };
        expect(setData(data, '/items/3', 4)).toBe(true);
        expect((data.items as DataValue[])[3]).toBe(4);
      });
    });

    describe('hasPath', () => {
      it('should return true for existing paths', () => {
        fc.assert(
          fc.property(
            simpleTokenArb,
            simpleDataValueArb,
            (key, value) => {
              const data: DataMap = { [key]: value };
              expect(hasPath(data, `/${key}`)).toBe(true);
            },
          ),
          { numRuns: 100 },
        );
      });

      it('should return false for non-existing paths', () => {
        fc.assert(
          fc.property(
            shallowDataMapArb,
            simpleTokenArb,
            (data, key) => {
              const safeKey = `__nonexistent_${key}__`;
              expect(hasPath(data, `/${safeKey}`)).toBe(false);
            },
          ),
          { numRuns: 100 },
        );
      });

      it('should return true for empty path', () => {
        const data: DataMap = { key: 'value' };
        expect(hasPath(data, '')).toBe(true);
      });
    });

    describe('deleteData', () => {
      it('should delete existing key', () => {
        fc.assert(
          fc.property(
            simpleTokenArb,
            simpleDataValueArb,
            (key, value) => {
              const data: DataMap = { [key]: value, other: 'keep' };
              const result = deleteData(data, `/${key}`);
              expect(result).toBe(true);
              expect(key in data).toBe(false);
              expect(data.other).toBe('keep');
            },
          ),
          { numRuns: 100 },
        );
      });

      it('should return false for non-existing key', () => {
        const data: DataMap = { key: 'value' };
        expect(deleteData(data, '/nonexistent')).toBe(false);
      });

      it('should return false for empty path', () => {
        const data: DataMap = { key: 'value' };
        expect(deleteData(data, '')).toBe(false);
      });

      it('should delete array element correctly', () => {
        const data: DataMap = { items: [1, 2, 3] };
        expect(deleteData(data, '/items/1')).toBe(true);
        expect(data.items).toEqual([1, 3]);
      });
    });

    describe('resolvePath', () => {
      it('should return absolute paths unchanged', () => {
        fc.assert(
          fc.property(validJsonPointerArb.filter(p => p.startsWith('/')), (path) => {
            expect(resolvePath(path)).toBe(path);
          }),
          { numRuns: 100 },
        );
      });

      it('should convert relative paths to absolute', () => {
        fc.assert(
          fc.property(simpleTokenArb, (token) => {
            const result = resolvePath(token);
            expect(result).toBe(`/${token}`);
          }),
          { numRuns: 100 },
        );
      });

      it('should resolve relative paths with context', () => {
        expect(resolvePath('name', '/user')).toBe('/user/name');
        expect(resolvePath('city', '/user/address')).toBe('/user/address/city');
      });

      it('should return empty string for empty path', () => {
        expect(resolvePath('')).toBe('');
      });
    });

    describe('getParentPath', () => {
      it('should return parent path correctly', () => {
        expect(getParentPath('/user/name')).toBe('/user');
        expect(getParentPath('/user')).toBe('');
        expect(getParentPath('/a/b/c')).toBe('/a/b');
      });

      it('should return null for empty path', () => {
        expect(getParentPath('')).toBeNull();
      });

      it('should return null for invalid path', () => {
        expect(getParentPath('invalid')).toBeNull();
      });
    });

    describe('getLastToken', () => {
      it('should return last token correctly', () => {
        expect(getLastToken('/user/name')).toBe('name');
        expect(getLastToken('/user')).toBe('user');
        expect(getLastToken('/a/b/c')).toBe('c');
      });

      it('should return null for empty path', () => {
        expect(getLastToken('')).toBeNull();
      });

      it('should return null for invalid path', () => {
        expect(getLastToken('invalid')).toBeNull();
      });
    });

    describe('joinPaths', () => {
      it('should join paths correctly', () => {
        expect(joinPaths('/user', 'name')).toBe('/user/name');
        expect(joinPaths('/user/address', 'city')).toBe('/user/address/city');
        expect(joinPaths('', 'user')).toBe('/user');
      });

      it('should return relative path if it is absolute', () => {
        expect(joinPaths('/user', '/absolute')).toBe('/absolute');
      });

      it('should throw for invalid base path', () => {
        expect(() => joinPaths('invalid', 'name')).toThrow(PathError);
      });
    });

    describe('getData with setData consistency', () => {
      it('should get what was set', () => {
        fc.assert(
          fc.property(
            simpleTokenArb,
            simpleDataValueArb,
            (key, value) => {
              const data: DataMap = {};
              setData(data, `/${key}`, value);
              const result = getData(data, `/${key}`);
              expect(result).toEqual(value);
            },
          ),
          { numRuns: 100 },
        );
      });

      it('should update existing value correctly', () => {
        fc.assert(
          fc.property(
            simpleTokenArb,
            simpleDataValueArb,
            simpleDataValueArb,
            (key, value1, value2) => {
              const data: DataMap = {};
              setData(data, `/${key}`, value1);
              expect(getData(data, `/${key}`)).toEqual(value1);
              setData(data, `/${key}`, value2);
              expect(getData(data, `/${key}`)).toEqual(value2);
            },
          ),
          { numRuns: 100 },
        );
      });
    });

    describe('hasPath with setData/deleteData consistency', () => {
      it('should return true after setData', () => {
        fc.assert(
          fc.property(
            simpleTokenArb,
            simpleDataValueArb,
            (key, value) => {
              const data: DataMap = {};
              expect(hasPath(data, `/${key}`)).toBe(false);
              setData(data, `/${key}`, value);
              expect(hasPath(data, `/${key}`)).toBe(true);
            },
          ),
          { numRuns: 100 },
        );
      });

      it('should return false after deleteData', () => {
        fc.assert(
          fc.property(
            simpleTokenArb,
            simpleDataValueArb,
            (key, value) => {
              const data: DataMap = { [key]: value };
              expect(hasPath(data, `/${key}`)).toBe(true);
              deleteData(data, `/${key}`);
              expect(hasPath(data, `/${key}`)).toBe(false);
            },
          ),
          { numRuns: 100 },
        );
      });
    });
  });
});
