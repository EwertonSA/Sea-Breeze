const path=require('path');
const {pathToFileURL}=require('url');
const {chromium}=require('playwright');

jest.setTimeout(60000);

describe('opening-view time control',()=>{
  let browser;
  let page;
  const consoleErrors=[];

  beforeAll(async()=>{
    jest.setTimeout(60000);
    browser=await chromium.launch({
      headless:true,
      args:[
        '--allow-file-access-from-files',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });
    page=await browser.newPage({viewport:{width:1280,height:720}});
    page.on('console',message=>{
      if(message.type()==='error')consoleErrors.push(message.text());
    });
    await page.goto(pathToFileURL(path.resolve(__dirname,'..','index.html')).href,{waitUntil:'commit'});
  });

  afterAll(async()=>{
    if(browser)await browser.close();
  });

  test('shows a labeled time control and valid clock display',async()=>{
    const timeInput=page.locator('#timeRange');
    const timeLabel=page.locator('label[for="timeRange"]');
    const clock=page.locator('#clock');

    await timeInput.waitFor({state:'attached',timeout:15000});
    await timeLabel.waitFor({state:'attached',timeout:15000});
    await clock.waitFor({state:'attached',timeout:15000});

    expect(await timeInput.isVisible()).toBe(true);
    expect(await timeLabel.textContent()).toContain('Time of day');
    expect(await clock.isVisible()).toBe(true);
    expect((await clock.textContent()).trim()).toMatch(/^\d{2}:\d{2}$/);
    expect(consoleErrors).toEqual([]);
  });
});
