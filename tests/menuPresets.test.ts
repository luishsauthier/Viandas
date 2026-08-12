import assert from 'node:assert/strict'
import {
  addMenuItem,
  ensureBaseItems,
  hasMenuItem,
  parseMenuLines,
  removeMenuItem,
  serializeMenuLines,
  toggleMenuItem,
} from '../src/lib/menus/presets.ts'

assert.deepEqual(parseMenuLines('Arroz\n\nFeijão\nArroz'), ['Arroz', 'Feijão'])
assert.equal(serializeMenuLines(['Arroz', 'Feijão']), 'Arroz\nFeijão')
assert.equal(hasMenuItem(['Arroz'], 'arroz'), true)
assert.deepEqual(toggleMenuItem(['Arroz'], 'Feijão'), ['Arroz', 'Feijão'])
assert.deepEqual(toggleMenuItem(['Arroz', 'Feijão'], 'arroz'), ['Feijão'])
assert.deepEqual(addMenuItem(['Arroz'], '  Feijão  '), ['Arroz', 'Feijão'])
assert.deepEqual(removeMenuItem(['Arroz', 'Feijão'], 'ARROZ'), ['Feijão'])
assert.deepEqual(ensureBaseItems(['Frango']), ['Arroz', 'Feijão', 'Frango'])
assert.deepEqual(ensureBaseItems(['Feijão', 'Massa']), ['Arroz', 'Feijão', 'Massa'])

console.log('menu presets tests passed')
