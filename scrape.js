// scrape.js
const puppeteer = require('puppeteer');

(async () => {
  const url = 'https://mp.weixin.qq.com/s/ZaQGbAzn0ICt0wuSDFpMbg';

  const browser = await puppeteer.launch({
    headless: true, // 设置为 false 可以看到浏览器界面，方便调试
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
    'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36');

  await page.goto(url, { waitUntil: 'networkidle2' });

  const result = await page.evaluate(() => {
    const title = document.querySelector('#activity-name')?.innerText.trim();
    const author = document.querySelector('#js_name')?.innerText.trim();
    const content = document.querySelector('#js_content')?.innerText.trim();
    return { title, author, content };
  });

  console.log('📌 标题：', result.title);
  console.log('👤 作者：', result.author);
  console.log('📄 正文内容：\n', result.content);

  await browser.close();
})();

