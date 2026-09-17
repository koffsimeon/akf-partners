/**
 * AKF PARTNERS — MODULE D'ÉCRITURE GOOGLE SHEETS (GoogleSheetsWriter)
 * 
 * Centralise les opérations d'écriture contrôlée non destructive (Phase 4) :
 * - insertOrAppendRow : écriture ciblée sur la première ligne libre (évite les formules orphelines)
 * - appendRow : ajout de ligne standard
 * - updateRowByPrimaryKey : mise à jour unitaire par ID unique
 * - deleteRowByPrimaryKey : suppression sécurisée avec fallback
 */

import { normalizeHeader } from './googleSheetsService';

export class GoogleSheetsWriter {
  /**
   * Écrit dans la première ligne disponible (où la colonne clé ID est vide),
   * ou ajoute à la fin si toutes les lignes existantes sont occupées.
   * Évite ainsi d'écrire après des centaines de lignes de formules pré-remplies (ex: ligne 988).
   */
  public static async insertOrAppendRow(
    spreadsheetId: string,
    accessToken: string,
    sheetTitle: string,
    rowValues: any[],
    primaryKeyColLetter = 'A'
  ): Promise<{ rowIndex: number; updatedRange: string }> {
    // 1. Lire la colonne clé pour trouver la première ligne où la clé est vide (à partir de la ligne 2)
    const getUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${encodeURIComponent(
      sheetTitle
    )}'!${primaryKeyColLetter}:${primaryKeyColLetter}`;

    const getRes = await fetch(getUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!getRes.ok) {
      const err = await getRes.text();
      throw new Error(`Impossible de vérifier les lignes disponibles dans "${sheetTitle}" : ${err}`);
    }

    const sheetData = await getRes.json();
    const colValues: any[][] = sheetData.values || [];

    // Trouver la première ligne (1-indexed pour Google Sheets, après l'en-tête en ligne 1) avec cellule vide
    let targetRowIndex = -1;
    for (let r = 1; r < colValues.length; r++) {
      const cellVal = colValues[r] && colValues[r][0] !== undefined ? String(colValues[r][0]).trim() : '';
      if (!cellVal) {
        targetRowIndex = r + 1; // 1-indexed pour Sheets
        break;
      }
    }

    // Si toutes les lignes existantes ont une valeur, écrire sur la ligne suivante
    if (targetRowIndex === -1) {
      targetRowIndex = colValues.length + 1;
      if (targetRowIndex < 2) targetRowIndex = 2;
    }

    // 2. Écrire les valeurs sur cette ligne exacte
    const updateRange = `'${sheetTitle}'!A${targetRowIndex}`;
    const putUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
      updateRange
    )}?valueInputOption=USER_ENTERED`;

    const putRes = await fetch(putUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range: updateRange,
        majorDimension: 'ROWS',
        values: [rowValues],
      }),
    });

    if (!putRes.ok) {
      const err = await putRes.text();
      throw new Error(`Échec d'écriture dans "${sheetTitle}" à la ligne ${targetRowIndex} : ${err}`);
    }

    return { rowIndex: targetRowIndex, updatedRange: updateRange };
  }

  /**
   * Ajoute une ligne à la fin d'un onglet sans écraser ni vider l'existant.
   */
  public static async appendRow(
    spreadsheetId: string,
    accessToken: string,
    sheetTitle: string,
    rowValues: any[]
  ): Promise<any> {
    const range = `'${sheetTitle}'!A:A`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
      range
    )}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range,
        majorDimension: 'ROWS',
        values: [rowValues],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Échec de l'ajout de ligne dans "${sheetTitle}" : ${err}`);
    }

    return response.json();
  }

  /**
   * Met à jour une ligne ciblée par son identifiant unique.
   */
  public static async updateRowByPrimaryKey(
    spreadsheetId: string,
    accessToken: string,
    sheetTitle: string,
    idColumnName: string,
    idValue: string,
    rowValues: any[]
  ): Promise<void> {
    // 1. Lire la colonne d'identifiants
    const getUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${sheetTitle}'!A1:Z`;
    const getRes = await fetch(getUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!getRes.ok) throw new Error(`Impossible de localiser l'ID ${idValue}`);
    const sheetData = await getRes.json();
    const rows: any[][] = sheetData.values || [];
    if (rows.length === 0) throw new Error(`L'onglet "${sheetTitle}" est vide`);

    const colMap = this.buildColumnIndexMap(rows[0]);
    const idIdx = colMap[normalizeHeader(idColumnName)];
    if (idIdx === undefined) throw new Error(`Colonne ID "${idColumnName}" introuvable`);

    let targetRowIndex = -1;
    for (let r = 1; r < rows.length; r++) {
      if (String(rows[r][idIdx] || '').trim() === idValue.trim()) {
        targetRowIndex = r + 1; // 1-indexed for Sheets
        break;
      }
    }

    if (targetRowIndex === -1) {
      throw new Error(`Enregistrement avec ${idColumnName} = "${idValue}" non trouvé.`);
    }

    // 2. Mettre à jour la ligne cible
    const updateRange = `'${sheetTitle}'!A${targetRowIndex}`;
    const putUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
      updateRange
    )}?valueInputOption=USER_ENTERED`;

    const putRes = await fetch(putUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range: updateRange,
        majorDimension: 'ROWS',
        values: [rowValues],
      }),
    });

    if (!putRes.ok) {
      const err = await putRes.text();
      throw new Error(`Échec de mise à jour de la ligne ${targetRowIndex} : ${err}`);
    }
  }

  /**
   * Supprime une ligne ciblée par son identifiant unique via batchUpdate deleteDimension
   * ou fallback clear.
   */
  public static async deleteRowByPrimaryKey(
    spreadsheetId: string,
    accessToken: string,
    sheetTitle: string,
    idColumnName: string,
    idValue: string
  ): Promise<void> {
    // 1. Lire la métadonnée du classeur pour récupérer l'ID numérique de l'onglet
    let sheetId: number | null = null;
    try {
      const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`;
      const metaRes = await fetch(metaUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (metaRes.ok) {
        const meta = await metaRes.json();
        const targetClean = sheetTitle.trim().toLowerCase();
        const found = (meta.sheets || []).find((s: any) => {
          const t = (s.properties?.title || '').trim().toLowerCase();
          return t === targetClean;
        });
        if (found && found.properties?.sheetId !== undefined) {
          sheetId = found.properties.sheetId;
        }
      }
    } catch (e) {
      console.warn(`[GoogleSheetsWriter] Impossible de récupérer sheetId pour "${sheetTitle}":`, e);
    }

    // 2. Trouver l'index de la ligne contenant l'identifiant
    const getUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${sheetTitle}'!A1:Z`;
    const getRes = await fetch(getUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!getRes.ok) {
      const err = await getRes.text();
      throw new Error(`Impossible de lire l'onglet "${sheetTitle}" pour suppression : ${err}`);
    }

    const sheetData = await getRes.json();
    const rows: any[][] = sheetData.values || [];
    if (rows.length === 0) return;

    const colMap = this.buildColumnIndexMap(rows[0]);
    const idIdx = colMap[normalizeHeader(idColumnName)];
    if (idIdx === undefined) {
      throw new Error(`Colonne ID "${idColumnName}" introuvable dans l'onglet "${sheetTitle}"`);
    }

    let targetRowZeroIndex = -1;
    for (let r = 1; r < rows.length; r++) {
      if (String(rows[r][idIdx] || '').trim() === idValue.trim()) {
        targetRowZeroIndex = r; // index base 0
        break;
      }
    }

    if (targetRowZeroIndex === -1) {
      // Déjà absent
      return;
    }

    // 3. Exécution de la suppression
    if (sheetId !== null) {
      // Suppression physique de la dimension ligne
      const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
      const batchRes = await fetch(batchUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId,
                  dimension: 'ROWS',
                  startIndex: targetRowZeroIndex,
                  endIndex: targetRowZeroIndex + 1,
                },
              },
            },
          ],
        }),
      });

      if (!batchRes.ok) {
        // Fallback effacement de la plage
        const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${sheetTitle}'!A${
          targetRowZeroIndex + 1
        }:Z${targetRowZeroIndex + 1}:clear`;
        await fetch(clearUrl, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
        });
      }
    } else {
      // Fallback effacement
      const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${sheetTitle}'!A${
        targetRowZeroIndex + 1
      }:Z${targetRowZeroIndex + 1}:clear`;
      await fetch(clearUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    }
  }

  private static buildColumnIndexMap(headerRow: any[] = []): Record<string, number> {
    const map: Record<string, number> = {};
    for (let i = 0; i < headerRow.length; i++) {
      const h = normalizeHeader(headerRow[i]);
      if (h) map[h] = i;
    }
    return map;
  }
}
