import test from 'node:test';
import assert from 'node:assert/strict';
import { nativeColorValue, createNativeColors } from '../native-colors.js';
test('native serialized colors become theme roles, including gradients and alpha',()=>{
  assert.equal(nativeColorValue('rgb(18, 18, 18)'), 'var(--spice-main)');
  assert.equal(nativeColorValue('rgba(255, 255, 255, 0.5)'), 'rgba(var(--spice-rgb-text), 0.5)');
  assert.equal(nativeColorValue('0 1px 8px rgba(0, 0, 0, 0.3)'), '0 1px 8px rgba(var(--spice-rgb-shadow), 0.3)');
  assert.equal(nativeColorValue('linear-gradient(#121212, #1db954)'), 'linear-gradient(var(--spice-main), var(--spice-button))');
  assert.equal(nativeColorValue('#fff8'), 'rgba(var(--spice-rgb-text), 0.533333)');
});
test('URLs, quoted strings, transparent and unrelated colors are not rewritten',()=>{
  assert.equal(nativeColorValue('url("icons.svg#fff")'), 'url("icons.svg#fff")');
  assert.equal(nativeColorValue('"#121212"'), '"#121212"');
  assert.equal(nativeColorValue('rgba(0, 0, 0, 0)'), 'rgba(0, 0, 0, 0)');
  assert.equal(nativeColorValue('#b68aff'), '#b68aff');
});
test('restoring native colors preserves a later edit by another extension',()=>{
  const values=new Map([['color','#fff'],['background-color','#121212'],['--spice-text','#fff']]);
  const declaration={ [Symbol.iterator]:()=>values.keys(),getPropertyValue:key=>values.get(key),getPropertyPriority:()=>'',setProperty:(key,value)=>values.set(key,value) };
  const sheet={href:'https://xpui.app.spotify.com/xpui-snapshot.css',ownerNode:{id:''},cssRules:[{style:declaration}]};
  const bridge=createNativeColors({styleSheets:[sheet]}); bridge.scan();
  assert.equal(values.get('color'),'var(--spice-text)'); assert.equal(values.get('--spice-text'),'#fff');
  values.set('color','#ff00ff'); bridge.restore();
  assert.equal(values.get('color'),'#ff00ff'); assert.equal(values.get('background-color'),'#121212');
});
