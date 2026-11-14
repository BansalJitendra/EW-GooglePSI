# Google PageSpeed Insights (PageSpeed Coach)

Integrate Google PageSpeed Insights into Experience Workspace to help content authors analyze page performance, identify optimization opportunities, and improve user experience without leaving the authoring environment. Compare the baseline and new scores before and after improvements. 

<img width="492" height="786" alt="pagespeed" src="https://github.com/user-attachments/assets/f5972b08-71d9-4b0e-8a85-93e27b7b15f3" />


## Plugin files

- `pagespeed/plugin.html`
- `pagespeed/plugin.css`
- `pagespeed/plugin.js`

Upload/host all three files from the `pagespeed/` folder in the same folder and configure Experience Workspace to open the full HTTPS URL of `plugin.html`. No backend or Worker is needed. Users may supply their own Google API key (Optional for demo).

## Author workflow

1. Open a page in Experience Workspace and launch PageSpeed Coach.
2. Panel automatically detects the published URL. Verify the auto-detected published page URL.
3. Choose Mobile or Desktop and click **Analyze page**.
4. Review Lighthouse scores, author-focused recommendations, and developer issues.
5. Save a baseline, edit and publish the page, then analyze again after the cache expires and compare.

## Test checklist

1. Confirm `pagespeed/plugin.html`, `pagespeed/plugin.css`, `pagespeed/plugin.js` each load with HTTP 200.
2. Check the Network tab for a request to `www.googleapis.com/pagespeedonline/v5/runPagespeed` with a `key` parameter when the API key field is populated.
3. If successful, run again and confirm the cached result displays without a second network call.
4. Wait for the cache to expire before verifying a new request for the same URL and device.
5. If Google responds with quota exceeded, confirm the error and Google website fallback are displayed.

This repository is not automatically deployed or submitted to the Marketplace.


## Create and enable a Google PageSpeed Insights API key (Optional for demo)

These steps are for a Google Cloud account belonging to the person or organization that will operate the plugin.

1. Open [Google Cloud Console](https://console.cloud.google.com/) and sign in.
2. Use the project selector at the top of the page to **create a project** (for example, `PageSpeed Coach`) or select an existing project you manage.
3. Open [APIs & Services > Library](https://console.cloud.google.com/apis/library) while that project is selected.
4. Search for **PageSpeed Insights API**, open its listing, and click **Enable**. If the page says **Manage**, it is already enabled.
5. Open [APIs & Services > Credentials](https://console.cloud.google.com/apis/credentials).
6. Click **Create credentials > API key** and copy the newly generated key. Do not put it in a public repository, issue, screenshot, or README.
7. Open the key's settings and under **API restrictions**, choose **Restrict key**, select **PageSpeed Insights API**, and save.
8. For a browser-hosted plugin, consider **Website restrictions (HTTP referrers)** limited to the actual plugin origin. Test this with your hosted Experience Workspace panel: referrer restrictions can fail depending on the browser's referrer policy or the hosting arrangement. If you cannot enforce a compatible browser restriction, prefer a server-side proxy rather than distributing the key in a public plugin.
9. In Experience Workspace, open **PageSpeed Coach**, paste the key into **Google API key**, select a public page URL, and click **Analyze page**.
10. If analysis fails, check the project's [APIs & Services > Quotas](https://console.cloud.google.com/apis/api/pagespeedonline.googleapis.com/quotas) for PageSpeed Insights API quota, and confirm the key's restrictions and selected project.

**Important:** The key is sent from the browser to Google's API and can be inspected in browser developer tools. Do not prefill or hardcode a real key in `plugin.html` or `plugin.js` when publishing to GitHub or the Experience Workspace Marketplace. For a zero-configuration Marketplace experience, store a publisher-managed key as a secret in a secured backend or AEM Edge Function and have the plugin call that backend. Rotate any key that has previously been embedded in publicly accessible HTML.

**Quick validation:** A successful request to `https://www.googleapis.com/pagespeedonline/v5/runPagespeed` should return JSON containing `lighthouseResult`. HTTP 403 often indicates an API enablement or key restriction problem; HTTP 429 indicates quota exhaustion. Creating a key does not guarantee unlimited quota or free hosting.
