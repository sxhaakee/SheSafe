// SheSafe API Client — connects to Shakeeb's FastAPI backend
// Replace BASE_URL with actual Railway URL once deployed

const BASE_URL = 'https://shesafe-api.railway.app';

export interface NearestStation {
    name: string;
    address: string;
    phone: string;
    distance_km: number;
}

export interface RiskScoreResponse {
    score: number;
    level: 'safe' | 'watchful' | 'alert' | 'emergency';
    contributing_factors: string[];
}

export interface AlertFireRequest {
    user_name: string;
    user_phone: string;
    lat: number;
    lng: number;
    address: string;
    risk_level: string;
    trusted_contacts: { name: string; phone: string }[];
    nearest_stations: NearestStation[];
}

export interface AlertFireResponse {
    alert_id: string;
    success: boolean;
    recipients: { name: string; status: 'sent' | 'failed' }[];
}

async function apiCall<T>(endpoint: string, body: object): Promise<T> {
    try {
        const response = await fetch(`${BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        return response.json();
    } catch (error) {
        console.error(`API call to ${endpoint} failed:`, error);
        throw error;
    }
}

export async function getNearestStations(lat: number, lng: number): Promise<NearestStation[]> {
    return apiCall<NearestStation[]>('/nearest-stations', { lat, lng });
}

export async function getRiskScore(params: {
    motion_state: string;
    lat: number;
    lng: number;
    timestamp: string;
    time_of_day: string;
    behavior_flags: string[];
}): Promise<RiskScoreResponse> {
    return apiCall<RiskScoreResponse>('/risk-score', params);
}

export async function fireAlert(data: AlertFireRequest): Promise<AlertFireResponse> {
    return apiCall<AlertFireResponse>('/alert/fire', data);
}

export async function sendLocationPing(alertId: string, lat: number, lng: number): Promise<void> {
    await apiCall('/alert/ping', {
        alert_id: alertId,
        lat,
        lng,
        timestamp: new Date().toISOString(),
    });
}
