/**
 * Script to extract negative reviews from Capterra using Scrappey MCP
 * 
 * This script demonstrates how to:
 * 1. Create a Scrappey session
 * 2. Navigate to the Capterra reviews page
 * 3. Extract negative reviews using JavaScript execution
 * 4. Parse and display the results
 */

// This would typically be called via MCP tools, but here's the approach:

const targetUrl = "https://www.capterra.fr/reviews/212653/scrapfly";

// Step 1: Create a session (using MCP tool: scrappey_create_session)
// Step 2: Use browser_action to navigate and extract reviews

const browserActions = [
  {
    type: "wait_for_load_state",
    waitForLoadState: "networkidle",
    timeout: 30000
  },
  {
    type: "wait",
    wait: 3000
  },
  {
    type: "execute_js",
    code: `
      // Function to extract negative reviews from Capterra page
      function extractNegativeReviews() {
        const reviews = [];
        
        // Common Capterra review selectors
        const possibleSelectors = [
          '[data-testid*="review"]',
          '.review-card',
          '.review-item',
          'article[class*="review"]',
          'div[class*="Review"]',
          '[data-review-id]'
        ];
        
        let reviewElements = [];
        
        // Try to find review containers
        for (const selector of possibleSelectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            reviewElements = Array.from(elements);
            break;
          }
        }
        
        // If no specific selector found, search by content patterns
        if (reviewElements.length === 0) {
          // Look for elements containing star ratings
          const allElements = document.querySelectorAll('div, article, section');
          reviewElements = Array.from(allElements).filter(el => {
            const text = el.textContent || '';
            // Look for rating patterns (1-2 stars indicate negative reviews)
            const hasLowRating = /([1-2])\\s*(?:out of|\\/|star|étoile|sur)/i.test(text);
            const hasRatingElement = el.querySelector('[aria-label*="1"], [aria-label*="2"], [class*="star"][class*="1"], [class*="star"][class*="2"]');
            return (hasLowRating || hasRatingElement) && text.length > 100;
          });
        }
        
        // Extract review data
        reviewElements.forEach((element, index) => {
          const fullText = element.textContent?.trim() || '';
          
          // Find rating information
          let starRating = null;
          const ratingElements = element.querySelectorAll('[class*="star"], [aria-label*="star"], svg');
          if (ratingElements.length > 0) {
            // Count filled/active stars
            const filledStars = Array.from(ratingElements).filter(star => {
              const classes = star.className?.baseVal || star.className || '';
              const ariaLabel = star.getAttribute('aria-label') || '';
              return /fill|active|selected|checked/i.test(classes) || 
                     /filled|active/i.test(ariaLabel) ||
                     star.getAttribute('data-rating');
            });
            starRating = filledStars.length;
          }
          
          // Check for explicit rating in text
          const ratingMatch = fullText.match(/([1-2])\\s*(?:out of|\\/|star|étoile|sur)\\s*5/i);
          if (ratingMatch) {
            starRating = parseInt(ratingMatch[1]);
          }
          
          // Identify negative keywords
          const negativeKeywords = [
            'disappoint', 'poor', 'bad', 'terrible', 'awful', 'horrible',
            'worst', 'not recommend', "don't recommend", 'avoid', 'problem',
            'issue', 'bug', 'broken', "doesn't work", 'failed', 'slow',
            'error', 'crash', 'unreliable', 'frustrating', 'waste', 'money'
          ];
          const hasNegativeKeywords = negativeKeywords.some(keyword => 
            new RegExp(keyword, 'i').test(fullText)
          );
          
          // Consider it negative if:
          // - 1-2 star rating, OR
          // - Has negative keywords and sufficient text length
          const isNegative = (starRating !== null && starRating <= 2) || 
                           (hasNegativeKeywords && fullText.length > 100);
          
          if (isNegative && fullText.length > 50) {
            // Extract review text (try to find the main review content)
            let reviewText = fullText;
            
            // Try to find a more specific review text element
            const textSelectors = [
              'p[class*="review"]',
              'div[class*="text"]',
              'div[class*="content"]',
              'div[class*="description"]',
              'p'
            ];
            
            for (const selector of textSelectors) {
              const textEl = element.querySelector(selector);
              if (textEl && textEl.textContent && textEl.textContent.length > 50) {
                reviewText = textEl.textContent.trim();
                break;
              }
            }
            
            // Clean up the text
            reviewText = reviewText
              .replace(/\\s+/g, ' ')
              .substring(0, 2000); // Limit length
            
            reviews.push({
              index: reviews.length + 1,
              text: reviewText,
              starRating: starRating,
              fullElementText: fullText.substring(0, 500), // For debugging
              hasNegativeKeywords: hasNegativeKeywords
            });
          }
        });
        
        // If still no reviews found, try a broader search
        if (reviews.length === 0) {
          const allTextElements = document.querySelectorAll('p, div[class*="text"], div[class*="content"]');
          allTextElements.forEach(el => {
            const text = el.textContent?.trim() || '';
            if (text.length > 100 && text.length < 2000) {
              const negativeKeywords = [
                'disappoint', 'poor', 'bad', 'terrible', 'awful', 'horrible',
                'worst', 'not recommend', "don't recommend", 'avoid', 'problem',
                'issue', 'bug', 'broken', "doesn't work", 'failed'
              ];
              const hasNegative = negativeKeywords.some(keyword => 
                new RegExp(keyword, 'i').test(text)
              );
              
              if (hasNegative) {
                reviews.push({
                  index: reviews.length + 1,
                  text: text,
                  starRating: null,
                  hasNegativeKeywords: true
                });
              }
            }
          });
        }
        
        return {
          success: true,
          totalNegativeReviews: reviews.length,
          reviews: reviews,
          pageTitle: document.title,
          url: window.location.href,
          timestamp: new Date().toISOString()
        };
      }
      
      return extractNegativeReviews();
    `
  }
];

// Usage with MCP tools:
// 1. scrappey_create_session() -> get sessionId
// 2. scrappey_browser_action({
//      session: sessionId,
//      url: targetUrl,
//      cmd: "request.get",
//      cloudflareBypass: true,
//      fullPageLoad: true,
//      browserActions: browserActions,
//      innerText: true
//    })

console.log("Script ready. Use with Scrappey MCP tools:");
console.log("1. Create session using scrappey_create_session");
console.log("2. Call scrappey_browser_action with the browserActions above");
console.log("3. Parse the JavaScript return value to get negative reviews");

