import {afterEach, describe, expect, it, vi} from 'vitest'
import {readAnonymousStatementDismissal, statementRefKey, writeAnonymousStatementDismissal} from './statement-dismissal.js'

const ref = {statementId: '018f0000-0000-7000-8000-000000000001', publishedVersion: 7}
function browser() {
 const values = new Map<string,string>()
 let cookie = ''
 const doc = {get cookie() {return cookie.split(';')[0] ?? ''}, set cookie(value:string) {cookie=value}}
 vi.stubGlobal('document', doc)
 vi.stubGlobal('location', {hostname:'www.alive.org.tw', protocol:'https:'})
 vi.stubGlobal('localStorage', {getItem:(key:string)=>values.get(key)??null, setItem:(key:string,value:string)=>values.set(key,value)})
 return {values, get cookie(){return cookie}, doc}
}
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers()})
describe('anonymous statement dismissal',()=>{
 it('persists the exact version across date changes and distinguishes new content',()=>{
  const b=browser(); vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-09T00:00:00Z'))
  expect(statementRefKey(ref)).toBe(`${ref.statementId}.7`)
  expect(writeAnonymousStatementDismissal(ref)).toBe(true)
  vi.setSystemTime(new Date('2028-01-01T00:00:00Z'))
  expect(readAnonymousStatementDismissal(ref)).toBe(true)
  expect(readAnonymousStatementDismissal({...ref,publishedVersion:8})).toBe(false)
  expect(readAnonymousStatementDismissal({...ref,statementId:'018f0000-0000-7000-8000-000000000002'})).toBe(false)
  expect(b.cookie).toContain('Max-Age=34560000');expect(b.cookie).toContain('Domain=alive.org.tw');expect(b.cookie).toContain('Secure')
 })
 it('shares through a cookie and ignores the old day cookie',()=>{
  const b=browser();b.doc.cookie=`hhc_statement_hidden_day=${ref.statementId}.2026-10-09`
  expect(readAnonymousStatementDismissal(ref)).toBe(false)
  b.doc.cookie=`hhc_statement_dismissed=${ref.statementId}.7`
  expect(readAnonymousStatementDismissal(ref)).toBe(true)
  expect(b.values.get(`hhc:statement:${ref.statementId}:dismissed-version`)).toBe('7')
 })
 it('uses local persistence without applying production domain on localhost',()=>{
  const b=browser();vi.stubGlobal('location',{hostname:'localhost',protocol:'http:'})
  expect(writeAnonymousStatementDismissal(ref)).toBe(true)
  expect(b.cookie).not.toContain('Domain=');expect(b.cookie).not.toContain('Secure')
  b.doc.cookie='';expect(readAnonymousStatementDismissal(ref)).toBe(true);expect(b.cookie).toContain('hhc_statement_dismissed=')
 })
 it('does not throw when browser storage is unavailable or server-rendered',()=>{
  browser();vi.stubGlobal('localStorage',{getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}})
  vi.stubGlobal('document',{get cookie(){throw Error('blocked')},set cookie(_v:string){throw Error('blocked')}})
  expect(readAnonymousStatementDismissal(ref)).toBe(false);expect(writeAnonymousStatementDismissal(ref)).toBe(false)
  vi.stubGlobal('document',undefined);vi.stubGlobal('localStorage',undefined)
  expect(readAnonymousStatementDismissal(ref)).toBe(false);expect(writeAnonymousStatementDismissal(ref)).toBe(false)
 })
 it('rejects invalid versions without persisting',()=>{
  const b=browser();expect(writeAnonymousStatementDismissal({...ref,publishedVersion:0})).toBe(false);expect(b.cookie).toBe('')
 })
})
