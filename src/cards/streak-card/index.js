import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { 
    getContributionGraphs,
    getContributionDates,
    getContributionStats,
    getWeeklyContributionStats,
    normalizeDays 
} from './stats.js';
import { renderOutput } from './card.js';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file
dotenv.config({ path: path.join(__dirname, '..', '.env') });

/**
 * Main request handler function
 * @param {Request} req - Express/HTTP request object
 * @param {Response} res - Express/HTTP response object
 */
export async function handleRequest(req, res) {
    // Check for environment variables
    if (!process.env.TOKEN) {
        const envPath = path.join(__dirname, '..', '.env');
        const message = require('fs').existsSync(envPath)
            ? "Missing token in config. Check Contributing.md for details."
            : ".env was not found. Check Contributing.md for details.";
        return renderOutput(message, 500);
    }

    // Set cache headers
    const cacheMinutes = 3 * 60 * 60; // 3 hours
    const expiresDate = new Date(Date.now() + cacheMinutes * 1000).toUTCString();
    const lastModified = new Date().toUTCString();
    
    res.setHeader('Expires', expiresDate);
    res.setHeader('Last-Modified', lastModified);
    res.setHeader('Cache-Control', `public, max-age=${cacheMinutes}`);

    // Redirect to demo if no user provided
    if (!req.query.user) {
        res.redirect('/demo/');
        return;
    }

    try {
        // Get streak stats for user
        const user = (req.query.user || '').replace(/[^a-zA-Z0-9\-]/g, '');
        const startingYear = req.query.starting_year ? parseInt(req.query.starting_year) : null;
        
        const contributionGraphs = await getContributionGraphs(user, startingYear);
        const contributions = await getContributionDates(contributionGraphs);
        
        let stats;
        if (req.query.mode === 'weekly') {
            stats = await getWeeklyContributionStats(contributions);
        } else {
            // Split and normalize excluded days
            const excludeDays = normalizeDays((req.query.exclude_days || '').split(','));
            stats = await getContributionStats(contributions, excludeDays);
        }
        
        await renderOutput(stats);
        
    } catch (error) {
        console.error(`Error ${error.code || 500}: ${error.message}`);
        if ((error.code || 500) >= 500) {
            console.error(error.stack);
        }
        await renderOutput(error.message, error.code || 500);
    }
}