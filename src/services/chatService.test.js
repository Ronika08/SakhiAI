import { describe, it, expect } from 'vitest'
import { getRuleResponse } from './chatService'

describe('Rule Engine + Intent Engine', () => {
  it('"Hi" → Greeting', () => {
    expect(getRuleResponse('Hi')).toMatchObject({ category: 'Greeting', isEmergency: false })
  })
  it('"I have PCOS" → PCOS category (generic reply)', () => {
    const r = getRuleResponse('I have PCOS')
    expect(r.category).toBe('PCOS')
    expect(r.intent).toBeNull()
  })
  it('"PCOS diet" → PCOS / Diet intent', () => {
    expect(getRuleResponse('PCOS diet')).toMatchObject({ category: 'PCOS', intent: 'Diet' })
  })
  it('"PCOS symptoms" → PCOS / Symptoms intent', () => {
    expect(getRuleResponse('PCOS symptoms')).toMatchObject({ category: 'PCOS', intent: 'Symptoms' })
  })
  it('"Someone is following me" → Emergency rule that opens the emergency screen', () => {
    expect(getRuleResponse('Someone is following me')).toMatchObject({
      category: 'Emergency', isEmergency: true, action: 'OPEN_EMERGENCY', intent: null,
    })
  })
  it('"Give me medicine dosage" → medication safety (Dosage intent)', () => {
    const r = getRuleResponse('Give me medicine dosage')
    expect(r.category).toBe('Medication Disclaimer')
    expect(r.intent).toBe('Dosage')
    expect(r.reply).toMatch(/doctor|pharmacist/i)
  })
  it('"Explain endometriosis" → no rule, falls through to the AI', () => {
    expect(getRuleResponse('Explain endometriosis')).toBeNull()
  })
  it('handles empty / non-string input', () => {
    expect(getRuleResponse('')).toBeNull()
    expect(getRuleResponse(null)).toBeNull()
    expect(getRuleResponse(42)).toBeNull()
  })
  it('does not write debug output to the console', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    getRuleResponse('PCOS diet')
    expect(spy).not.toHaveBeenCalled()
  })
})
