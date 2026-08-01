import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAtlasPrompt } from './atlas-prompt.js';

test('buildAtlasPrompt includes Atlas voice and history context', () => {
  const messages = buildAtlasPrompt({
    message: 'Yapay zeka hakkında konuşalım',
    history: [
      { role: 'user', content: 'Merhaba' },
      { role: 'assistant', content: 'Merhaba! Size nasıl yardımcı olabilirim?' },
    ],
  });

  assert.equal(messages[0].role, 'system');
  assert.match(messages[0].content, /DURUM/);
  assert.match(messages[0].content, /Atlas/);
  assert.match(messages[0].content, /kullanıcıyla birlikte düşün/i);

  assert.equal(messages[1].role, 'user');
  assert.match(messages[1].content, /Kullanıcı: Merhaba/);
  const joined = messages.map((entry) => entry.content).join('\n');
  assert.match(joined, /Kullanıcı: Yapay zeka hakkında konuşalım/);
});

test('buildAtlasPrompt instructs Atlas to use a short question-driven structure', () => {
  const messages = buildAtlasPrompt({ message: 'İş değiştirmeyi düşünüyorum.' });
  const content = messages[0].content;

  assert.match(content, /kısa, yapılandırılmış/i);
  assert.match(content, /soru sorar/i);
  assert.match(content, /risk/i);
  assert.match(content, /DURUM/);
});

test('buildAtlasPrompt includes long-term memory guidance and structured alternatives', () => {
  const messages = buildAtlasPrompt({
    message: 'Telefon almayı düşünüyorum.',
    memorySummary: 'Hedefler: iyi fiyat/performans. Tercihler: iOS, uzun pil ömrü.',
  });
  const content = messages[0].content;

  assert.match(content, /uzun süreli hafıza/i);
  assert.match(content, /alternatif/i);
  assert.match(content, /risk/i);
  assert.match(content, /öğrenmeyi/i);
});

test('buildAtlasPrompt preserves prior turns as structured memory', () => {
  const messages = buildAtlasPrompt({
    message: 'Adım neydi?',
    history: [
      { role: 'user', content: 'Benim adım Ahmet.' },
      { role: 'assistant', content: 'Memnun oldum Ahmet.' },
    ],
  });

  assert.deepEqual(messages.slice(1).map((entry) => entry.role), ['user', 'assistant', 'user']);
  assert.match(messages[1].content, /Benim adım Ahmet/i);
  assert.match(messages[2].content, /Memnun oldum Ahmet/i);
  assert.match(messages[3].content, /Adım neydi/i);
});
