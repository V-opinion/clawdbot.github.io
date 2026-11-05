import fetch from "node-fetch";
import * as cheerio from "cheerio";

const WORKER_INGEST_URL = "https://ai-assistant.multireligionvalsystem.eu.org/api/ingest";
const INGEST_SECRET = "my_super_secret_legal_key_123"; // Must match your Wrangler secret

const ECOSYSTEM_URLS = [
    "https://frc.multireligionvalsystem.eu.org/",
    "https://fdu.multireligionvalsystem.eu.org/",
    "https://dpns.multireligionvalsystem.eu.org/",
    "https://community.multireligionvalsystem.eu.org/",
    "https://multi-religion-support.multireligionvalsystem.eu.org/",
    "https://www.multireligionvalsystem.eu.org/global-tillampning/",
    "https://www.multireligionvalsystem.eu.org/How-to-Implement-a-Multi-Religion-Electoral-System-A-Step-by-Step-Guide/",
    "https://podcastaddict.com/podcast/multireligionvalsystem/5523379",
    "https://open.spotify.com/show/1xGfGGcgy0zZ0NJ7l3ykxX",
    "https://open.spotify.com/episode/55uMkBW38vgY365R7hjcoU",
    "https://open.spotify.com/episode/71J08EKjowcn1pneRAF2qj",
    "https://www.youtube.com/@faith-representatives",
    "https://www.facebook.com/amultireligionelectionsystem",
    "http://se.linkedin.com/in/solidarity",
    "https://www.instagram.com/multireligionval/",
    "https://twitter.com/DPNS",
    "https://www.tiktok.com/@multireligionvalsystem?lang=en"
];

function chunkText(text, chunkSize = 500) {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const chunks = [];
    let currentChunk = "";

    for (const sentence of sentences) {
        if ((currentChunk + sentence).length > chunkSize) {
            if (currentChunk.trim()) chunks.push(currentChunk.trim());
            currentChunk = sentence;
        } else {
            currentChunk += " " + sentence;
        }
    }
    if (currentChunk.trim()) chunks.push(currentChunk.trim());
    return chunks;
}

async function scrapeUrl(url) {
    console.log(`\n🔍 Processing source: ${url}`);
    try {
        const response = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept-Language": "en-US,en;q=0.9"
            }
        });

        if (!response.ok) {
            console.warn(`⚠️ Note: Received status ${response.status} for social profile ${url}. Generating contextual fallback reference.`);
            return generateSocialFallback(url);
        }

        const html = await response.text();
        const $ = cheerio.load(html);
        $("script, style, nav, footer, iframe, noscript").remove();

        const pageTitle = $("title").text().trim();
        const metaDesc = $('meta[name="description"]').attr("content") || '';
        const ogDesc = $('meta[property="og:description"]').attr("content") || '';
        const bodyText = $("body").text().replace(/\s+/g, " ").trim();

        // If the platform blocks scraping with login walls or empty bodies, use intelligent fallback
        if (bodyText.length < 150 || url.includes("instagram.com") || url.includes("facebook.com") || url.includes("tiktok.com")) {
            return generateSocialFallback(url, pageTitle, metaDesc || ogDesc);
        }

        const combined = `Official Social Media / Community Channel: ${url}. Title: ${pageTitle}. Description: ${metaDesc || ogDesc}. Content: ${bodyText.substring(0, 1500)}`;
        return chunkText(combined);
    } catch (err) {
        console.error(`❌ Failed to fetch ${url}: ${err.message}`);
        return generateSocialFallback(url);
    }
}

// Generates robust context for heavily guarded social networks
function generateSocialFallback(url, title = "", desc = "") {
    let platformName = "Social Media Channel";
    if (url.includes("youtube.com")) platformName = "YouTube Official Channel (@faith-representatives)";
    if (url.includes("facebook.com")) platformName = "Facebook Official Page (A Multi-Religion Election System)";
    if (url.includes("linkedin.com")) platformName = "LinkedIn Professional Network Profile (Solidarity / De Nya Svenskarna)";
    if (url.includes("instagram.com")) platformName = "Instagram Multireligionval Handle (@multireligionval)";
    if (url.includes("twitter.com")) platformName = "X (Twitter) Official Handle (@DPNS)";
    if (url.includes("tiktok.com")) platformName = "TikTok Official Channel (@multireligionvalsystem)";

    const contextString = `Official Digital Channel Reference: ${platformName}. URL: ${url}. This channel publishes updates, community announcements, video media, and civic discussions regarding the Multireligionvalsystem, De Nya Svenskarna (DNS) ecosystem, and the Faith Representatives Chamber (FRC). ${title ? "Page Title: " + title : ""} ${desc ? "Summary: " + desc : ""}`;
    return chunkText(contextString);
}

async function uploadChunksToWorker(chunks, sourceUrl) {
    if (!chunks || chunks.length === 0) return;

    try {
        const response = await fetch(WORKER_INGEST_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${INGEST_SECRET}`
            },
            body: JSON.stringify({ chunks, source: sourceUrl })
        });

        const data = await response.json();
        if (data.success) {
            console.log(`✅ Successfully indexed ${data.count} chunks from: ${sourceUrl}`);
        } else {
            console.error(`❌ Ingestion failed for ${sourceUrl}:`, data.error);
        }
    } catch (err) {
        console.error(`❌ Network error uploading ${sourceUrl}:`, err.message);
    }
}

async function runIngestion() {
    console.log("🚀 Starting expanded ecosystem and social media ingestion...");
    for (const url of ECOSYSTEM_URLS) {
        const chunks = await scrapeUrl(url);
        await uploadChunksToWorker(chunks, url);
    }
    console.log("\n🎉 Social media profiles and ecosystem sources successfully indexed into Vectorize!");
}

runIngestion();