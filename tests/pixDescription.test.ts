import assert from 'node:assert/strict'
import {
  previewPixDescriptionTemplate,
  resolvePixDescriptionTemplate,
} from '../src/lib/pix/descriptionTemplate.ts'

assert.equal(
  resolvePixDescriptionTemplate('Viandas {{nome}} {{semana}} {{mes}}/{{ano}}', {
    employeeName: 'João Pedro',
    weekStartDate: '2026-08-11',
    weekEndDate: '2026-08-15',
    amount: 40.5,
  }),
  'Viandas João 11/08 - 15/08 agosto/2026',
)

assert.equal(
  resolvePixDescriptionTemplate('Pagamento {{valor}} - {{nome_completo}}', {
    employeeName: 'Ana Costa',
    weekStartDate: '2026-03-03',
    weekEndDate: '2026-03-07',
    amount: 40.5,
  }),
  'Pagamento 40 REAIS 50 - Ana Costa',
)

assert.equal(previewPixDescriptionTemplate('{{nome}} {{mes}}').includes('Maria'), true)
assert.equal(resolvePixDescriptionTemplate(null, {
  employeeName: 'X',
  weekStartDate: '2026-01-01',
  weekEndDate: '2026-01-05',
}), '')

console.log('pix description template tests passed')
