const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// 读取链接文件并过滤
const links = fs
  .readFileSync('jike_links.txt', 'utf-8')
  .split('\n')
  .map(l => l.trim())
  .map(line => line.replaceAll('来源：', ''))
  .filter(l => l.startsWith('https://m.okjike.com/originalPosts/'));

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  );

  for (const [index, url] of links.entries()) {
    try {
      console.log(`🚀 [${index + 1}/${links.length}] 正在抓取：${url}`);
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

      // 等待页面加载完成
      await page.waitForSelector('#__next > div > div.post-page', {
        timeout: 10000,
      });

      // 抓取数据
      const result = await page.evaluate(() => {
        // 提取文章内容
        const _content =
          document.querySelector('#__next > div > div.post-page')?.innerText ||
          '';

        const content = _content
          .replaceAll('来自圈子', '')
          .replaceAll('热门评论', '');

        // 提取标题、作者、时间等信息
        const title = document.title.replaceAll(' - 即刻App', '').trim();
        const author =
          document.querySelector(
            '#__next > div > div.post-page > div.post-wrap > div.wrap > div.info > div.title',
          )?.innerText || '无作者';

        const time =
          document.querySelector('.post-page .post-header .post-time')
            ?.innerText || '无时间';

        // 提取图片
        const images = Array.from(document.querySelectorAll('img'))
          .map(img => img.src)
          .filter(src => !src.includes('thumbnail/120x120')); // 删除缩略图

        return { title, author, time, content, images };
      });

      // 清理标题，确保文件名合法
      const safeTitle = result.title
        .slice(0, 50)
        .replace(/[\/\\:*?"<>|]/g, '_');

      const mdContent =
        `\n\n[${safeTitle}](${url})\n\n**作者**：${result.author}\n\n---\n\n${result.content}\n\n` +
        (result.images.length
          ? `**图片**：\n` + result.images.map(url => `![](${url})`).join('\n')
          : '');

      // 创建文件夹并保存 Markdown 文件
      fs.mkdirSync('posts', { recursive: true });
      fs.writeFileSync(path.join('posts', `${safeTitle}.md`), mdContent);

      console.log(`✅ 成功保存：${safeTitle}.md`);
    } catch (err) {
      console.error(`❌ 抓取失败：${url}`);
      console.error(err.message);
    }
  }

  await browser.close();
})();
