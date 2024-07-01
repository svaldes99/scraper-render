const puppeteer = require('puppeteer');

async function launchBrowser() {
    console.log('Launching a new browser instance...');
    console.log('process.env.PUPPETEER_EXECUTABLE_PATH:', process.env.PUPPETEER_EXECUTABLE_PATH);
    return await puppeteer.launch({
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || puppeteer.executablePath(),
        args: [
            "--disable-setuid-sandbox",
            "--no-sandbox",
            "--single-process",
            "--no-zygote",
        ],
    });
}

// Function to extract news details from a single URL
async function extractNewsDetails(url) {
    const browser = await launchBrowser();
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    try {
        const title = await page.$eval('h1.ArticleSingle_title__0DNjm', element => element.textContent.trim());
        const category = await page.$eval('a.text-primary-main', element => element.textContent.trim());
        const readTimeText = await page.$eval('div.Text_body__snVk8', element => element.textContent.trim());
        const readTime = parseInt(readTimeText.split(' ')[0]) || 0;
        const author = await page.$eval('div.text-sm', element => element.textContent.trim());

        return { title, category, readTime, author };
    } catch (error) {
        console.error('Error extracting news details:', error);
        return { title: 'No title found', category: 'No category found', readTime: 0, author: 'No author found' };
    } finally {
        await browser.close();
    }
}

// Function to extract all news from a given URL
async function extractAllNews(url) {
    const browser = await launchBrowser();
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    try {
        while (true) {
            await page.waitForSelector('button.inline-flex.cursor-pointer');
            await page.click('button.inline-flex.cursor-pointer');

            await page.waitForSelector('button.inline-flex.cursor-pointer.disabled', { hidden: true });
        }
    } catch (error) {
        // TimeoutException is expected here
    }

    const newsLinks = await page.$$eval('a.absolute.z-10.h-full.w-full', links => links.map(link => link.href));
    const newsDetails = [];

    for (const link of newsLinks) {
        const details = await extractNewsDetails(link);
        newsDetails.push(details);

        // Clean data
        details.title = cleanString(details.title);
        details.category = cleanString(details.category);
        details.author = cleanString(details.author);
        // Probar con 1 noticia
        break;
    }

    await browser.close();
    return newsDetails;
}

// Function to extract all categories from the base URL
async function extractAllCategories(baseUrl) {
    const browser = await launchBrowser();
    const page = await browser.newPage();
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });

    const categoryLinks = await page.$$eval('a.relative.z-10.flex.cursor-pointer.items-center.py-[11px].text-xs.font-semibold.tracking-wide.text-xsky-700.transition.duration-300.hover:text-xindigo-500.xl:text-sm', links => links.map(link => link.href.split('/').pop()));

    await browser.close();
    return categoryLinks;
}

// Main function to initiate scraping and writing to Google Sheets
async function main(category) {
    try {
        // Base URL for the blog
        const baseUrl = 'https://xepelin.com/blog';

        // Extract all categories if 'todo' is provided as category argument
        let categories;
        if (category === 'todo') {
            categories = await extractAllCategories(baseUrl);
        } else {
            categories = [category];
        }

        // Extract news details for each category
        let allNewsDetails = [];
        for (const cat of categories) {
            const url = `${baseUrl}/${cat}`;
            const newsDetails = await extractAllNews(url);
            allNewsDetails = [...allNewsDetails, ...newsDetails];
        }

        // Write data to Google Sheets
        await writeToGoogleSheet(allNewsDetails);

        console.log('News details have been written to the Google Sheet.');
    } catch (error) {
        console.error('Error in main function:', error);
        process.exit(1);
    }
}

// Run main function if executed directly
if (require.main === module) {
    const category = process.argv[2];
    main(category).catch(error => {
        console.error('Error in main function:', error);
        process.exit(1);
    });
}

module.exports = { main };
