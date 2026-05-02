// SheSafe — Evidence Upload Service
// Uploads audio/video recordings to the backend, which stores them in Supabase Storage.
// Returns the public URL so police can view/play the evidence.

import ApiService from './ApiService';

const BASE_URL = ApiService.BASE_URL;

/**
 * Upload an audio or video evidence file to the backend.
 * @param {string} alertId  - The active alert ID
 * @param {string} uri      - Local file URI (from expo-av or expo-camera)
 * @param {'audio'|'video'} type
 * @returns {Promise<string|null>} Public URL or null on failure
 */
export async function uploadEvidence(alertId, uri, type) {
  if (!alertId || !uri) return null;

  try {
    const ext  = type === 'audio' ? 'm4a' : 'mp4';
    const mime = type === 'audio' ? 'audio/m4a' : 'video/mp4';

    const formData = new FormData();
    formData.append('alert_id',      alertId);
    formData.append('evidence_type', type);
    formData.append('file', {
      uri,
      name: `evidence_${type}_${Date.now()}.${ext}`,
      type: mime,
    });

    const res = await fetch(`${BASE_URL}/alert/evidence`, {
      method:  'POST',
      body:    formData,
      // Do NOT set Content-Type manually — let fetch set multipart boundary
    });

    if (!res.ok) {
      console.warn('[Evidence] Upload failed:', res.status);
      return null;
    }

    const data = await res.json();
    console.log(`[Evidence] ${type} uploaded ✅:`, data.url);
    return data.url || null;
  } catch (e) {
    console.warn('[Evidence] Upload error:', e.message);
    return null;
  }
}
