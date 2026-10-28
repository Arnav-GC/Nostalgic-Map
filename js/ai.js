/**
 * @file ai.js
 * @description AI analysis module using Google Gemini 2.0 Flash for photo descriptions.
 */

const CANDIDATE_MODELS = [
  'gemini-flash-lite-latest',
  'gemini-flash-latest',
  'gemini-3.5-flash-lite',
  'gemini-3.8-flash',
  'gemini-3.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
];

export class AIAnalyzer {
  constructor() {
    /** @type {string} */
    this.apiKey = '';
    /** @type {string} */
    this.activeModel = CANDIDATE_MODELS[0];
  }

  _endpoint(model = this.activeModel) {
    return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  }

  /**
   * Sets the Gemini API key.
   * @param {string} key
   */
  setApiKey(key) {
    this.apiKey = (key || '').trim();
  }

  /**
   * Returns the stored API key.
   * @returns {string}
   */
  getApiKey() {
    return this.apiKey;
  }

  /**
   * Analyzes a photo and returns a warm, descriptive caption.
   * @param {string} photoDataUrl - Base64 data URL of the image
   * @returns {Promise<string>} Description text
   */
  async analyzePhoto(photoDataUrl) {
    if (!this.apiKey) {
      return '✨ Add a Gemini API key in Settings to get AI descriptions of your photos!';
    }

    const prompt =
      'You are a friendly memory journal assistant. Look at this photo and describe what you see in 2-3 warm, descriptive sentences. ' +
      'Mention the setting, people (if any), mood, notable objects, and any text visible. ' +
      'Make it feel like a diary entry. Be specific and vivid.';

    try {
      const base64Data = this._extractBase64(photoDataUrl);
      const mimeType = this._extractMimeType(photoDataUrl);

      const body = {
        contents: [{
          parts: [
            { text: prompt },
            { inlineData: { mimeType, data: base64Data } },
          ],
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 300,
        },
      };

      let response = null;
      let lastErr = null;

      for (const model of CANDIDATE_MODELS) {
        try {
          response = await fetch(`${this._endpoint(model)}?key=${encodeURIComponent(this.apiKey)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          if (response.ok) {
            this.activeModel = model;
            break;
          }
          const errData = await response.json().catch(() => ({}));
          lastErr = errData.error?.message || `HTTP ${response.status}`;
        } catch (e) {
          lastErr = e.message;
        }
      }

      if (!response || !response.ok) {
        throw new Error(lastErr || 'API request failed');
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) throw new Error('No description returned');
      return text.trim();
    } catch (err) {
      console.error('AI analysis failed:', err);
      return `🤖 Couldn't analyze this photo: ${err.message}`;
    }
  }

  /**
   * Generates a nostalgic story from a group of memories at the same location.
   * @param {Array<{description: string, locationName: string, timestamp: number}>} memories
   * @returns {Promise<string>}
   */
  async generateLocationStory(memories) {
    if (!this.apiKey) {
      return 'Add a Gemini API key to generate stories about your memories!';
    }

    const descriptions = memories
      .map((m) => m.description)
      .filter(Boolean)
      .join('\n- ');

    const locationName = memories[0]?.locationName || 'this place';

    const prompt =
      `Based on these photo descriptions from ${locationName}, write a short 2-3 sentence ` +
      `nostalgic story about the memories made here. Make it warm and personal:\n- ${descriptions}`;

    try {
      const body = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.8, maxOutputTokens: 200 },
      };

      let response = null;
      let lastErr = null;

      for (const model of CANDIDATE_MODELS) {
        try {
          response = await fetch(`${this._endpoint(model)}?key=${encodeURIComponent(this.apiKey)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          if (response.ok) {
            this.activeModel = model;
            break;
          }
          const errData = await response.json().catch(() => ({}));
          lastErr = errData.error?.message || `HTTP ${response.status}`;
        } catch (e) {
          lastErr = e.message;
        }
      }

      if (!response || !response.ok) throw new Error(lastErr || 'API request failed');

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      return text?.trim() || 'Could not generate story.';
    } catch (err) {
      console.error('Story generation failed:', err);
      return `Couldn't generate story: ${err.message}`;
    }
  }

  /**
   * Tests if an API key is valid.
   * @param {string} key
   * @returns {Promise<{valid: boolean, error?: string}>}
   */
  async testApiKey(key) {
    if (!key || key.length < 10) {
      return { valid: false, error: 'Key is too short' };
    }

    try {
      let lastResponse = null;
      for (const model of CANDIDATE_MODELS) {
        const response = await fetch(`${this._endpoint(model)}?key=${encodeURIComponent(key)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Hi' }] }],
            generationConfig: { maxOutputTokens: 5 },
          }),
        });

        lastResponse = response;

        if (response.status === 200 || response.status === 429) {
          this.activeModel = model;
          return { valid: true };
        }
      }

      const errData = lastResponse ? await lastResponse.json().catch(() => ({})) : {};
      return { valid: false, error: errData.error?.message || (lastResponse ? `HTTP ${lastResponse.status}` : 'Request failed') };
    } catch (err) {
      return { valid: false, error: err.message };
    }
  }

  /**
   * Extracts base64 data from a data URL.
   * @private
   */
  _extractBase64(dataUrl) {
    const idx = dataUrl.indexOf(',');
    return idx >= 0 ? dataUrl.substring(idx + 1) : dataUrl;
  }

  /**
   * Extracts MIME type from a data URL.
   * @private
   */
  _extractMimeType(dataUrl) {
    const match = dataUrl.match(/^data:([^;]+);/);
    return match ? match[1] : 'image/jpeg';
  }
}

export const aiAnalyzer = new AIAnalyzer();
