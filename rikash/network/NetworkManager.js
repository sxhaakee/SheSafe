/**
 * SheSafe — Network Detection + SMS Fallback
 * Rikash's Domain: Online/offline detection with dual-coverage alert dispatch
 * 
 * Strategy:
 * - Always send native SMS regardless of connectivity (non-negotiable)
 * - If online, ALSO call Shakeeb's API for dashboard + logging
 * - Queue API calls when offline, flush when back online
 */

import NetInfo from '@react-native-community/netinfo';
import * as SMS from 'expo-sms';
import AsyncStorage from '@react-native-async-storage/async-storage';

const OFFLINE_QUEUE_KEY = 'shesafe_offline_queue';
const API_BASE_KEY = 'shesafe_api_base_url';

class NetworkManager {
  constructor() {
    this.isConnected = true;
    this.connectionType = 'unknown';
    this.unsubscribe = null;
    this.onStatusChange = null;
    this.isMonitoring = false;
  }

  /**
   * Start monitoring network status
   */
  startMonitoring(onStatusChange = null) {
    if (this.isMonitoring) return;
    this.onStatusChange = onStatusChange;

    this.unsubscribe = NetInfo.addEventListener((state) => {
      const wasConnected = this.isConnected;
      this.isConnected = state.isConnected && state.isInternetReachable;
      this.connectionType = state.type;

      console.log(`[SheSafe Network] ${this.isConnected ? '🟢 Online' : '🔴 Offline'} (${state.type})`);

      // If we just came back online, flush the queue
      if (!wasConnected && this.isConnected) {
        this._flushOfflineQueue();
      }

      if (this.onStatusChange) {
        this.onStatusChange({
          isConnected: this.isConnected,
          type: this.connectionType,
        });
      }
    });

    this.isMonitoring = true;
    console.log('[SheSafe Network] Monitoring started');
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.isMonitoring = false;
  }

  /**
   * Check current network status (one-shot)
   */
  async checkStatus() {
    const state = await NetInfo.fetch();
    this.isConnected = state.isConnected && state.isInternetReachable;
    this.connectionType = state.type;
    return { isConnected: this.isConnected, type: this.connectionType };
  }

  /**
   * MAIN DISPATCH — Send emergency alert with dual coverage
   * Always sends native SMS. Also calls API if online.
   * 
   * @param {Object} alertData - Alert payload
   * @param {string} alertData.user_name
   * @param {string} alertData.user_phone
   * @param {number} alertData.lat
   * @param {number} alertData.lng
   * @param {string} alertData.address
   * @param {string} alertData.risk_level
   * @param {Array} alertData.trusted_contacts - [{name, phone}]
   * @param {Array} alertData.nearest_stations - [{name, phone, address}]
   */
  async dispatchAlert(alertData) {
    const results = {
      sms_police: [],
      sms_contacts: [],
      api_success: false,
      api_error: null,
      mode: this.isConnected ? 'online' : 'offline',
    };

    // ---- STEP 1: ALWAYS send native SMS (non-negotiable) ----
    const smsAvailable = await SMS.isAvailableAsync();
    
    if (smsAvailable) {
      // SMS to police stations
      for (const station of alertData.nearest_stations) {
        const policeMsg = this._formatPoliceSMS(alertData, station);
        try {
          const { result } = await SMS.sendSMSAsync([station.phone], policeMsg);
          results.sms_police.push({
            station: station.name,
            phone: station.phone,
            status: result,
          });
        } catch (e) {
          results.sms_police.push({
            station: station.name,
            phone: station.phone,
            status: 'failed',
            error: e.message,
          });
        }
      }

      // SMS to trusted contacts
      for (const contact of alertData.trusted_contacts) {
        const contactMsg = this._formatContactSMS(alertData);
        try {
          const { result } = await SMS.sendSMSAsync([contact.phone], contactMsg);
          results.sms_contacts.push({
            name: contact.name,
            phone: contact.phone,
            status: result,
          });
        } catch (e) {
          results.sms_contacts.push({
            name: contact.name,
            phone: contact.phone,
            status: 'failed',
            error: e.message,
          });
        }
      }
    } else {
      console.warn('[SheSafe Network] SMS not available on this device');
    }

    // ---- STEP 2: Call API if online, queue if offline ----
    if (this.isConnected) {
      try {
        const apiBase = await AsyncStorage.getItem(API_BASE_KEY);
        if (apiBase) {
          const response = await fetch(`${apiBase}/alert/fire`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(alertData),
          });

          if (response.ok) {
            const data = await response.json();
            results.api_success = true;
            results.api_data = data;
          } else {
            results.api_error = `API returned ${response.status}`;
          }
        }
      } catch (e) {
        results.api_error = e.message;
        // Queue for later
        await this._queueForOffline('alert/fire', alertData);
      }
    } else {
      // Queue API call for when we're back online
      await this._queueForOffline('alert/fire', alertData);
      console.log('[SheSafe Network] API call queued for offline flush');
    }

    return results;
  }

  /**
   * Format SMS message for police stations
   */
  _formatPoliceSMS(alertData, station) {
    const mapsLink = `https://maps.google.com/?q=${alertData.lat},${alertData.lng}`;
    const now = new Date();
    const timeStr = now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    return `SHESAFE EMERGENCY ALERT
Name: ${alertData.user_name}
Phone: ${alertData.user_phone}
Location: ${alertData.lat.toFixed(4)}° N, ${alertData.lng.toFixed(4)}° E
Address: ${alertData.address || 'Unknown'}
Time: ${timeStr}
Risk: ${alertData.risk_level.toUpperCase()} — Multiple distress signals detected
Maps: ${mapsLink}
Emergency Contact: ${alertData.trusted_contacts[0]?.phone || 'N/A'} (${alertData.trusted_contacts[0]?.name || 'N/A'})`;
  }

  /**
   * Format SMS message for trusted contacts
   */
  _formatContactSMS(alertData) {
    const mapsLink = `https://maps.google.com/?q=${alertData.lat},${alertData.lng}`;
    const now = new Date();
    const timeStr = now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    return `SHESAFE SOS: ${alertData.user_name} needs help.
Location: ${alertData.address || 'Unknown'}
Maps: ${mapsLink}
Time: ${timeStr}
Risk Level: ${alertData.risk_level.toUpperCase()}
Call her: ${alertData.user_phone}`;
  }

  /**
   * Queue an API call for later execution when online
   */
  async _queueForOffline(endpoint, data) {
    try {
      const existing = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
      const queue = existing ? JSON.parse(existing) : [];
      queue.push({
        endpoint,
        data,
        timestamp: Date.now(),
      });
      await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    } catch (e) {
      console.error('[SheSafe Network] Failed to queue:', e.message);
    }
  }

  /**
   * Flush queued API calls when back online
   */
  async _flushOfflineQueue() {
    try {
      const existing = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
      if (!existing) return;

      const queue = JSON.parse(existing);
      if (queue.length === 0) return;

      console.log(`[SheSafe Network] Flushing ${queue.length} queued API calls`);
      const apiBase = await AsyncStorage.getItem(API_BASE_KEY);
      if (!apiBase) return;

      const remaining = [];
      for (const item of queue) {
        try {
          await fetch(`${apiBase}/${item.endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...item.data,
              _queued_at: item.timestamp,
              _sent_at: Date.now(),
            }),
          });
          console.log(`[SheSafe Network] Flushed: ${item.endpoint}`);
        } catch (e) {
          remaining.push(item); // Keep in queue if still failing
        }
      }

      await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
    } catch (e) {
      console.error('[SheSafe Network] Flush failed:', e.message);
    }
  }

  /**
   * Get number of queued items
   */
  async getQueueSize() {
    const existing = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    return existing ? JSON.parse(existing).length : 0;
  }
}

export const networkManager = new NetworkManager();
export default NetworkManager;
