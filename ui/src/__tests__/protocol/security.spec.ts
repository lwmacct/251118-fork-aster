/**
 * Aster UI Protocol - 安全性工具函数属性测试
 *
 * Feature: aster-ui-protocol
 * Property 10: XSS 防护
 * Property 11: URL 安全验证
 *
 * 验证: 需求 7.2, 7.3
 */

import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import {
  sanitizeText,
  containsXSS,
  validateUrl,
  getUrlScheme,
  sanitizeUrl,
  ALLOWED_URL_SCHEMES,
} from '@/protocol/security';

// ==================
// Arbitrary Generators
// ==================

/**
 * 生成包含 XSS 攻击代码的文本
 */
const xssPayloadArb = fc.oneof(
  // Script 标签
  fc.tuple(fc.string(), fc.string()).map(([before, after]) =>
    `${before}<script>alert("xss")</script>${after}`),
  fc.tuple(fc.string(), fc.string()).map(([before, after]) =>
    `${before}<SCRIPT>alert('xss')</SCRIPT>${after}`),
  fc.tuple(fc.string(), fc.string()).map(([before, after]) =>
    `${before}<script src="evil.js"></script>${after}`),

  // 事件处理器
  fc.tuple(fc.string(), fc.string()).map(([before, after]) =>
    `${before}<img onerror="alert('xss')" src="x">${after}`),
  fc.tuple(fc.string(), fc.string()).map(([before, after]) =>
    `${before}<div onclick="alert('xss')">click</div>${after}`),
  fc.tuple(fc.string(), fc.string()).map(([before, after]) =>
    `${before}<body onload="alert('xss')">${after}`),

  // javascript: URL
  fc.tuple(fc.string(), fc.string()).map(([before, after]) =>
    `${before}<a href="javascript:alert('xss')">click</a>${after}`),

  // iframe 注入
  fc.tuple(fc.string(), fc.string()).map(([before, after]) =>
    `${before}<iframe src="evil.html"></iframe>${after}`),

  // object/embed 注入
  fc.tuple(fc.string(), fc.string()).map(([before, after]) =>
    `${before}<object data="evil.swf"></object>${after}`),
  fc.tuple(fc.string(), fc.string()).map(([before, after]) =>
    `${before}<embed src="evil.swf">${after}`),

  // style 注入
  fc.tuple(fc.string(), fc.string()).map(([before, after]) =>
    `${before}<style>body{background:url("javascript:alert('xss')")}</style>${after}`),

  // CSS expression
  fc.tuple(fc.string(), fc.string()).map(([before, after]) =>
    `${before}<div style="width:expression(alert('xss'))"></div>${after}`),
);

/**
 * 生成安全的文本（不包含 HTML 特殊字符）
 */
const safeTextArb = fc.string().filter(s => !/[&<>"'`=/]/.test(s));

/**
 * 生成包含 HTML 特殊字符的文本
 */
const htmlSpecialCharsArb = fc.oneof(
  fc.constant('&'),
  fc.constant('<'),
  fc.constant('>'),
  fc.constant('"'),
  fc.constant('\''),
  fc.constant('/'),
  fc.constant('`'),
  fc.constant('='),
  fc.string().map(s => `<${s}>`),
  fc.string().map(s => `"${s}"`),
  fc.string().map(s => `'${s}'`),
);

/**
 * 生成安全的 URL（使用允许的协议）
 */
const safeUrlArb = fc.oneof(
  // HTTPS URLs
  fc.webUrl({ validSchemes: ['https'] }),
  // HTTP URLs
  fc.webUrl({ validSchemes: ['http'] }),
  // Data URLs (images)
  fc.constant('data:image/png;base64,iVBORw0KGgo='),
  fc.constant('data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'),
  // Relative URLs
  fc.constant('/path/to/resource'),
  fc.constant('./relative/path'),
  fc.constant('../parent/path'),
);

/**
 * 生成不安全的 URL（使用危险的协议）
 */
const unsafeUrlArb = fc.oneof(
  // javascript: URLs
  fc.string().map(s => `javascript:${s}`),
  fc.constant('javascript:alert("xss")'),
  fc.constant('javascript:void(0)'),

  // vbscript: URLs
  fc.string().map(s => `vbscript:${s}`),
  fc.constant('vbscript:msgbox("xss")'),

  // data:text/html URLs (can execute scripts)
  fc.string().map(s => `data:text/html,<script>${s}</script>`),
  fc.constant('data:text/html,<script>alert("xss")</script>'),
);

// ==================
// Property Tests
// ==================

describe('Security Functions', () => {
  describe('Property 10: XSS 防护', () => {
    /**
     * Feature: aster-ui-protocol, Property 10: XSS 防护
     * 验证: 需求 7.2
     *
     * 对于任意包含潜在 XSS 攻击代码的文本内容（如 <script> 标签），
     * 渲染器应该正确清理文本，防止脚本执行。
     */

    it('should escape all HTML special characters', () => {
      fc.assert(
        fc.property(fc.string(), (text) => {
          const sanitized = sanitizeText(text);

          // 清理后的文本不应包含未转义的 HTML 特殊字符
          // 除非原文本不包含这些字符
          if (text.includes('<')) {
            expect(sanitized).toContain('&lt;');
            expect(sanitized).not.toMatch(/<(?!&)/);
          }
          if (text.includes('>')) {
            expect(sanitized).toContain('&gt;');
          }
          if (text.includes('"')) {
            expect(sanitized).toContain('&quot;');
          }
          if (text.includes('\'')) {
            expect(sanitized).toContain('&#x27;');
          }
          if (text.includes('&') && !text.includes('&amp;') && !text.includes('&lt;') && !text.includes('&gt;') && !text.includes('&quot;')) {
            expect(sanitized).toContain('&amp;');
          }
        }),
        { numRuns: 100 },
      );
    });

    it('should neutralize XSS payloads', () => {
      fc.assert(
        fc.property(xssPayloadArb, (payload) => {
          const sanitized = sanitizeText(payload);

          // 清理后的文本不应包含可执行的 script 标签
          expect(sanitized).not.toMatch(/<script\b[^>]*>/i);
          expect(sanitized).not.toMatch(/<\/script>/i);

          // 清理后的文本不应包含事件处理器
          expect(sanitized).not.toMatch(/on\w+\s*=/i);

          // 清理后的文本不应包含危险的 iframe/object/embed 标签
          expect(sanitized).not.toMatch(/<iframe\b[^>]*>/i);
          expect(sanitized).not.toMatch(/<object\b[^>]*>/i);
          expect(sanitized).not.toMatch(/<embed\b[^>]*>/i);
        }),
        { numRuns: 100 },
      );
    });

    it('should preserve safe text unchanged', () => {
      fc.assert(
        fc.property(safeTextArb, (text) => {
          const sanitized = sanitizeText(text);

          // 不包含特殊字符的文本应该保持不变
          expect(sanitized).toBe(text);
        }),
        { numRuns: 100 },
      );
    });

    it('should detect XSS patterns correctly', () => {
      fc.assert(
        fc.property(xssPayloadArb, (payload) => {
          // XSS 载荷应该被检测到
          expect(containsXSS(payload)).toBe(true);
        }),
        { numRuns: 100 },
      );
    });

    it('should not flag safe text as XSS', () => {
      fc.assert(
        fc.property(safeTextArb, (text) => {
          // 安全文本不应该被标记为 XSS
          expect(containsXSS(text)).toBe(false);
        }),
        { numRuns: 100 },
      );
    });

    it('should handle non-string inputs gracefully', () => {
      // @ts-expect-error Testing invalid input
      expect(sanitizeText(null)).toBe('');
      // @ts-expect-error Testing invalid input
      expect(sanitizeText(undefined)).toBe('');
      // @ts-expect-error Testing invalid input
      expect(sanitizeText(123)).toBe('');
      // @ts-expect-error Testing invalid input
      expect(sanitizeText({})).toBe('');
    });

    it('should produce output that does not contain raw HTML special characters', () => {
      fc.assert(
        fc.property(fc.string(), (text) => {
          const sanitized = sanitizeText(text);

          // 清理后的文本不应包含未转义的 < 或 > 字符
          // 这些是最危险的 XSS 向量
          expect(sanitized).not.toMatch(/(?<!&lt|&gt|&amp|&quot|&#x27|&#x2F|&#x60|&#x3D)[<>]/);
        }),
        { numRuns: 100 },
      );
    });
  });

  describe('Property 11: URL 安全验证', () => {
    /**
     * Feature: aster-ui-protocol, Property 11: URL 安全验证
     * 验证: 需求 7.3
     *
     * 对于任意 URL 属性值，渲染器应该验证 URL 方案是否在允许列表中
     * （https、http、data），拒绝不安全的 URL 方案（如 javascript:）。
     */

    it('should accept URLs with allowed schemes', () => {
      fc.assert(
        fc.property(safeUrlArb, (url) => {
          expect(validateUrl(url)).toBe(true);
        }),
        { numRuns: 100 },
      );
    });

    it('should reject URLs with dangerous schemes', () => {
      fc.assert(
        fc.property(unsafeUrlArb, (url) => {
          expect(validateUrl(url)).toBe(false);
        }),
        { numRuns: 100 },
      );
    });

    it('should correctly identify URL schemes', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...ALLOWED_URL_SCHEMES),
          fc.webPath(),
          (scheme, path) => {
            const url = `${scheme}//example.com${path}`;
            const detectedScheme = getUrlScheme(url);

            expect(detectedScheme).toBe(scheme);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should handle invalid URLs gracefully', () => {
      // 空字符串
      expect(validateUrl('')).toBe(false);

      // 空白字符串
      expect(validateUrl('   ')).toBe(false);

      // @ts-expect-error Testing invalid input
      expect(validateUrl(null)).toBe(false);

      // @ts-expect-error Testing invalid input
      expect(validateUrl(undefined)).toBe(false);

      // @ts-expect-error Testing invalid input
      expect(validateUrl(123)).toBe(false);
    });

    it('should accept relative URLs as safe', () => {
      const relativeUrls = [
        '/absolute/path',
        './relative/path',
        '../parent/path',
        '/path/to/image.png',
        './styles/main.css',
      ];

      for (const url of relativeUrls) {
        expect(validateUrl(url)).toBe(true);
      }
    });

    it('should sanitize URLs correctly', () => {
      fc.assert(
        fc.property(safeUrlArb, (url) => {
          const sanitized = sanitizeUrl(url);

          // 安全的 URL 应该保持不变
          expect(sanitized).toBe(url);
        }),
        { numRuns: 100 },
      );
    });

    it('should return empty string for unsafe URLs', () => {
      fc.assert(
        fc.property(unsafeUrlArb, (url) => {
          const sanitized = sanitizeUrl(url);

          // 不安全的 URL 应该返回空字符串
          expect(sanitized).toBe('');
        }),
        { numRuns: 100 },
      );
    });

    it('should reject javascript: URLs in various forms', () => {
      const javascriptUrls = [
        'javascript:alert("xss")',
        'JAVASCRIPT:alert("xss")',
        'JavaScript:alert("xss")',
        'javascript:void(0)',
        '  javascript:alert("xss")  ',
      ];

      for (const url of javascriptUrls) {
        expect(validateUrl(url)).toBe(false);
      }
    });

    it('should accept data: URLs for images but reject data:text/html', () => {
      // 安全的 data URLs
      expect(validateUrl('data:image/png;base64,iVBORw0KGgo=')).toBe(true);
      expect(validateUrl('data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7')).toBe(true);

      // 危险的 data URLs
      expect(validateUrl('data:text/html,<script>alert("xss")</script>')).toBe(false);
    });
  });
});
