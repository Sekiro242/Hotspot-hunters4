import {chromium} from 'playwright';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
await page.goto('http://127.0.0.1:5173');await page.waitForTimeout(6500);
await page.screenshot({path:'tests/desktop-entry.png'});
console.log(JSON.stringify({errors,canvas:await page.locator('canvas').count(),title:await page.title()}));
await browser.close();
