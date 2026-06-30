import React, { useState, useEffect } from 'react';
import { Database, FileSpreadsheet, RefreshCw, PlusCircle, CheckCircle, Search, LogIn, LogOut, ArrowRight, FileText } from 'lucide-react';
import { getAccessToken, logout } from '../auth';
import { TriageRecord, FrequencyRecord } from '../types';

interface WorkspaceSyncProps {
  accessToken: string | null;
  onLogin: () => void;
  userEmail?: string;
  onSyncFrequencies: (freqs: FrequencyRecord[]) => void;
  onSyncTriage: (triage: TriageRecord[]) => void;
  onLogMessage: (msg: string) => void;
}

export const WorkspaceSync: React.FC<WorkspaceSyncProps> = ({
  accessToken,
  onLogin,
  userEmail,
  onSyncFrequencies,
  onSyncTriage,
  onLogMessage,
}) => {
  const [spreadsheets, setSpreadsheets] = useState<any[]>([]);
  const [selectedSheetId, setSelectedSheetId] = useState<string>('');
  const [sheetLoading, setSheetLoading] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<string>('idle');
  const [docsList, setDocsList] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Fetch spreadsheets and Google Docs from Google Drive
  const fetchDriveFiles = async () => {
    if (!accessToken) return;
    setSheetLoading(true);
    onLogMessage(">>> DISCOVERING LOGISTICS DOCUMENTS IN GOOGLE DRIVE...");
    try {
      // Fetch Spreadsheets
      const sheetRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.spreadsheet'&fields=files(id,name,webViewLink)&pageSize=15`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      if (sheetRes.ok) {
        const sheetData = await sheetRes.json();
        setSpreadsheets(sheetData.files || []);
        onLogMessage(`>>> DISCOVERED ${sheetData.files?.length || 0} GOOGLE SPREADSHEETS`);
      }

      // Fetch Docs
      const docRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.document'&fields=files(id,name,webViewLink)&pageSize=10`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      if (docRes.ok) {
        const docData = await docRes.json();
        setDocsList(docData.files || []);
        onLogMessage(`>>> DISCOVERED ${docData.files?.length || 0} GOOGLE DOCUMENTS`);
      }
    } catch (err: any) {
      console.error(err);
      onLogMessage(`>>> DRIVE LOOKUP ERROR: ${err.message}`);
    } finally {
      setSheetLoading(false);
    }
  };

  useEffect(() => {
    if (accessToken) {
      fetchDriveFiles();
    }
  }, [accessToken]);

  // Create or Initialize a default tactical logistics spreadsheet
  const handleInitializeSpreadsheet = async () => {
    if (!accessToken) return;

    setSheetLoading(true);
    onLogMessage(">>> PROVISIONING NEW TACTICAL LOGISTICS SPREADSHEET...");
    try {
      // 1. Create Spreadsheet
      const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          properties: { title: 'W.O.L.F. Tactical Database' },
          sheets: [
            { properties: { title: 'Frequencies' } },
            { properties: { title: 'Triage_Log' } },
          ],
        }),
      });

      if (!createRes.ok) {
        throw new Error('Failed to create sheet skeleton');
      }

      const sheetInfo = await createRes.json();
      const newSheetId = sheetInfo.spreadsheetId;
      setSelectedSheetId(newSheetId);
      onLogMessage(`>>> TACTICAL SPREADSHEET PROVISIONED: ${newSheetId}`);

      // 2. Populate Frequencies sheet header & records
      const freqHeaders = ['Channel', 'Frequency', 'Description', 'Type', 'Status', 'LastActive'];
      const defaultFrequencies = [
        ['APD ZONE 1', '460.125', 'Atlanta Police Zone 1 Patrol Dispatch', 'police', 'active', new Date().toISOString()],
        ['APD ZONE 2', '460.225', 'Atlanta Police Zone 2 Buckhead Operations', 'police', 'monitoring', new Date().toISOString()],
        ['AFD CHANNEL 3', '154.280', 'Atlanta Fire Tactical operations', 'fire', 'active', new Date().toISOString()],
        ['GA STATE PATROL', '154.920', 'Georgia State Patrol regional dispatch', 'police', 'idle', new Date().toISOString()],
        ['CH-16 MARINE', '156.800', 'Coast Guard / Distress / Emergency call channel', 'tactical', 'monitoring', new Date().toISOString()],
      ];

      const triageHeaders = ['Procedure_Title', 'Priority_Calculation', 'Instructions'];
      const defaultTriage = [
        ['HEAVY ARTERIAL BLEEDING', 'CRITICAL PRIORITY 1', '1. Apply direct pressure over bleeding point with sterile dressing.\n2. Wrap tightly with elastic trauma bandage.\n3. If extremity, apply high & tight tourniquet immediately; log timestamp.\n4. Treat for impending shock.'],
        ['SUDDEN CARDIAC ARREST', 'CRITICAL PRIORITY 1', '1. Confirm unresponsive & pulseless.\n2. Initiate immediate chest compressions at 100-120 CPM.\n3. Deploy AED if nearby; follow step-by-step instructions.\n4. Call advanced life support immediately.'],
        ['TENSION PNEUMOTHORAX', 'HIGH PRIORITY 2', '1. Look for progressive respiratory distress & tracheal shift.\n2. Locate 2nd intercostal space, mid-clavicular line.\n3. Prepare 14-gauge needle chest decompression.\n4. Dress with three-sided occlusive chest seal.'],
        ['SEVERE SMOKE INHALATION', 'MEDIUM PRIORITY 3', '1. Evacuate patient to open air environment.\n2. Administer humidified high-flow oxygen.\n3. Monitor airway patency continually; evaluate carbon monoxide risk.'],
      ];

      // Update values for Frequencies
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${newSheetId}/values/Frequencies!A1:F${defaultFrequencies.length + 1}?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            range: `Frequencies!A1:F${defaultFrequencies.length + 1}`,
            majorDimension: 'ROWS',
            values: [freqHeaders, ...defaultFrequencies],
          }),
        }
      );

      // Update values for Triage Log
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${newSheetId}/values/Triage_Log!A1:C${defaultTriage.length + 1}?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            range: `Triage_Log!A1:C${defaultTriage.length + 1}`,
            majorDimension: 'ROWS',
            values: [triageHeaders, ...defaultTriage],
          }),
        }
      );

      onLogMessage(">>> INITIAL PROTOCOLS & RADIO CHANNELS SYNCHRONIZED.");
      await fetchDriveFiles();
      setSyncStatus('success');
    } catch (err: any) {
      console.error(err);
      onLogMessage(`>>> INITIALIZATION FAILURE: ${err.message}`);
    } finally {
      setSheetLoading(false);
    }
  };

  // Sync / Download data from the selected Spreadsheet
  const handleSyncData = async () => {
    if (!accessToken || !selectedSheetId) return;
    setSheetLoading(true);
    onLogMessage(`>>> INITIATING UPLINK WITH SHEET ID: ${selectedSheetId}...`);
    try {
      // 1. Sync Frequencies
      const freqRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${selectedSheetId}/values/Frequencies!A1:F50`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (freqRes.ok) {
        const freqData = await freqRes.json();
        const rows = freqData.values;
        if (rows && rows.length > 1) {
          const headers = rows[0].map((h: string) => h.trim().toLowerCase());
          const records: FrequencyRecord[] = [];

          for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const channel = row[headers.indexOf('channel')] || row[0] || '';
            const frequency = row[headers.indexOf('frequency')] || row[1] || '';
            const description = row[headers.indexOf('description')] || row[2] || '';
            const typeRaw = row[headers.indexOf('type')] || row[3] || 'tactical';
            const statusRaw = row[headers.indexOf('status')] || row[4] || 'monitoring';
            const lastActive = row[headers.indexOf('lastactive')] || row[5] || '';

            if (channel && frequency) {
              records.push({
                channel,
                frequency,
                description,
                type: typeRaw.toLowerCase() as any,
                status: statusRaw.toLowerCase() as any,
                lastActive,
              });
            }
          }
          if (records.length > 0) {
            onSyncFrequencies(records);
            onLogMessage(`>>> RECOVERED ${records.length} RADIO CHANNELS FROM GOOGLE SPREADSHEET`);
          }
        }
      } else {
        onLogMessage(">>> WARNING: 'Frequencies' worksheet not found. Skipping frequency pull.");
      }

      // 2. Sync Triage Log
      const triageRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${selectedSheetId}/values/Triage_Log!A1:C50`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (triageRes.ok) {
        const triageData = await triageRes.json();
        const rows = triageData.values;
        if (rows && rows.length > 1) {
          const headers = rows[0].map((h: string) => h.trim());
          const records: TriageRecord[] = [];

          for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const procedure = row[0] || '';
            const priority = row[1] || '';
            const instructions = row[2] || '';

            if (procedure) {
              records.push({
                Procedure_Title: procedure,
                Priority_Calculation: priority,
                Instructions: instructions,
              });
            }
          }
          if (records.length > 0) {
            onSyncTriage(records);
            onLogMessage(`>>> RECOVERED ${records.length} TACTICAL MEDICAL PROTOCOLS FROM SPREADSHEET`);
          }
        }
      } else {
        onLogMessage(">>> WARNING: 'Triage_Log' worksheet not found. Skipping triage pull.");
      }

      setSyncStatus('success');
      onLogMessage(">>> GOOGLE WORKSPACE SYNCHRONIZATION SECURED.");
    } catch (err: any) {
      console.error(err);
      onLogMessage(`>>> SYNC CRITICAL EXCEPTION: ${err.message}`);
    } finally {
      setSheetLoading(false);
    }
  };

  return (
    <div className="bg-neutral-900 border border-emerald-500/10 rounded-lg p-5 font-mono text-xs">
      {!accessToken ? (
        <div className="text-center py-6">
          <Database className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-neutral-300 font-display">GOOGLE WORKSPACE OFFLINE</h3>
          <p className="text-neutral-500 text-[11px] mt-1 mb-4 max-w-sm mx-auto">
            Securely authorize the tactical grid to download triage instructions, medical files, and patrol radio frequencies directly from your Google Sheets & Docs.
          </p>
          <button
            onClick={onLogin}
            className="gsi-material-button mx-auto flex items-center justify-center gap-2 bg-white text-neutral-800 font-bold px-4 py-2 rounded hover:bg-neutral-100 transition shadow"
          >
            <div className="gsi-material-button-icon w-4 h-4">
              <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: 'block' }}>
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                <path fill="none" d="M0 0h48v48H0z"></path>
              </svg>
            </div>
            <span>Sign in with Google</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-emerald-500/10 pb-3">
            <div>
              <span className="text-[10px] text-emerald-500 font-bold block uppercase tracking-wider">UPLINK ACTIVE</span>
              <span className="text-neutral-300 font-semibold">{userEmail || "Operative Active"}</span>
            </div>
            <button
              onClick={async () => {
                await logout();
                window.location.reload();
              }}
              className="text-neutral-500 hover:text-rose-400 text-[10px] border border-neutral-800 hover:border-rose-400/20 px-2.5 py-1 rounded transition"
            >
              Sign Out
            </button>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] text-neutral-400 font-semibold uppercase flex items-center gap-1.5">
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                Select Active Intelligence Sheet
              </label>
              <button
                onClick={handleInitializeSpreadsheet}
                className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-bold text-[10px] transition"
              >
                <PlusCircle className="w-3 h-3" />
                Initialize New
              </button>
            </div>

            <div className="flex gap-2">
              <select
                value={selectedSheetId}
                onChange={(e) => setSelectedSheetId(e.target.value)}
                className="flex-grow bg-neutral-950 border border-neutral-800 text-neutral-300 rounded px-3 py-2 outline-none focus:border-emerald-500/40 text-xs"
              >
                <option value="">-- Choose Sheet from Google Drive --</option>
                {spreadsheets.map((sheet) => (
                  <option key={sheet.id} value={sheet.id}>
                    {sheet.name}
                  </option>
                ))}
              </select>

              <button
                onClick={handleSyncData}
                disabled={!selectedSheetId || sheetLoading}
                className={`px-4 py-2 bg-emerald-500 text-neutral-950 rounded font-bold uppercase transition flex items-center gap-1.5 ${
                  !selectedSheetId || sheetLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-emerald-400'
                }`}
              >
                {sheetLoading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                Sync
              </button>
            </div>
          </div>

          {spreadsheets.length === 0 && !sheetLoading && (
            <div className="bg-neutral-950/40 border border-neutral-800 p-3 rounded text-[11px] text-neutral-400">
              No spreadsheets detected. Click <strong className="text-emerald-400">"Initialize New"</strong> above to instantly generate a compatible template with emergency frequencies and tactical medical guides in your Google Drive.
            </div>
          )}

          {docsList.length > 0 && (
            <div>
              <h4 className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-neutral-500" />
                Operational Briefs (Google Docs)
              </h4>
              <div className="bg-neutral-950 border border-neutral-800 rounded max-h-36 overflow-y-auto divide-y divide-neutral-900 custom-scrollbar">
                {docsList.map((doc) => (
                  <a
                    key={doc.id}
                    href={doc.webViewLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-2.5 hover:bg-neutral-900 text-neutral-400 hover:text-emerald-400 transition"
                  >
                    <span className="truncate pr-3 font-semibold text-neutral-300">{doc.name}</span>
                    <ArrowRight className="w-3 h-3 flex-shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
