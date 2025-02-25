import { app } from "electron";
import { config } from "@/main/Config/config";
const log = require('electron-log');

import path from "path";
import Database from 'better-sqlite3';

const appDataPath = app.getPath('userData');
const db = new Database(path.join(appDataPath, 'db.sqlite3'));

function initializeBotsTable() {
    const stmt = db.prepare(`
        CREATE TABLE bots (
            id NUMBER PRIMARY KEY UNIQUE, 
            origin TEXT,
            account_id NUMBER,
            account_name TEXT,
            name TEXT,
            pairs TEXT,
            active_deals_count NUMBER,
            active_deals_usd_profit NUMBER,
            active_safety_orders_count NUMBER,
            base_order_volume NUMBER,
            base_order_volume_type TEXT,
            created_at TEXT,
            updated_at TEXT,
            enabled_active_funds NUMBER,
            enabled_inactive_funds NUMBER,
            finished_deals_count NUMBER,
            finished_deals_profit_usd NUMBER,
            from_currency TEXT,
            is_enabled BOOLEAN,
            martingale_coefficient NUMBER,
            martingale_volume_coefficient NUMBER,
            martingale_step_coefficient NUMBER,
            max_active_deals NUMBER,
            max_funds NUMBER,
            max_funds_per_deal NUMBER,
            max_inactive_funds NUMBER,
            max_safety_orders NUMBER,
            profit_currency TEXT,
            safety_order_step_percentage NUMBER,
            safety_order_volume NUMBER,
            safety_order_volume_type TEXT,
            stop_loss_percentage NUMBER,
            strategy TEXT,
            take_profit TEXT,
            take_profit_type TEXT,
            trailing_deviation NUMBER,
            type TEXT,
            price_deviation NUMBER,
            drawdown NUMBER,
            maxCoveragePercent NUMBER,
            maxSoReached NUMBER,
            hide BOOLEAN,
            profile_id VARCHAR(36)
            )`);

    stmt.run();

}

/**
 * TODO 
 * - Swap the  profitPercent table to be hourly_per_unit_profit_percent since this is divided by the hours.
 */
function initializeDealTable() {
    const stmt = db.prepare(`
        CREATE TABLE deals (
            id NUMBER PRIMARY KEY UNIQUE, 
            type TEXT, 
            bot_id NUMBER,
            max_safety_orders NUMBER,
            deal_has_error BOOLEAN,
            from_currency_id NUMBER,
            to_currency_id NUMBER,
            account_id NUMBER,
            active_safety_orders_count NUMBER,
            created_at TEXT,
            updated_at TEXT,
            closed_at TEXT,
            closed_at_iso_string NUMBER,
            finished BOOLEAN,
            current_active_safety_orders_count BOOLEAN,
            current_active_safety_orders NUMBER,
            completed_safety_orders_count NUMBER,
            completed_manual_safety_orders_count NUMBER,
            cancellable BOOLEAN,
            panic_sellable BOOLEAN,
            trailing_enabled BOOLEAN,
            tsl_enabled BOOLEAN,
            stop_loss_timeout_enabled BOOLEAN,
            stop_loss_timeout_in_seconds NUMBER,
            active_manual_safety_orders NUMBER,
            pair TEXT,
            status TEXT,
            localized_status TEXT,
            take_profit NUMBER,
            base_order_volume NUMBER,
            safety_order_volume NUMBER,
            safety_order_step_percentage NUMBER,
            leverage_type TEXT,
            leverage_custom_value NUMBER,
            bought_amount NUMBER,
            bought_volume NUMBER,
            bought_average_price NUMBER,
            base_order_average_price NUMBER,
            sold_amount NUMBER,
            sold_volume NUMBER,
            sold_average_price NUMBER,
            take_profit_type TEXT,
            final_profit NUMBER,
            martingale_coefficient NUMBER,
            martingale_volume_coefficient NUMBER,
            martingale_step_coefficient NUMBER,
            stop_loss_percentage NUMBER,
            error_message TEXT,
            profit_currency TEXT,
            stop_loss_type TEXT,
            safety_order_volume_type TEXT,
            base_order_volume_type TEXT,
            from_currency TEXT,
            to_currency TEXT,
            current_price NUMBER,
            take_profit_price NUMBER,
            stop_loss_price NUMBER,
            final_profit_percentage NUMBER,
            actual_profit_percentage NUMBER,
            bot_name TEXT,
            account_name TEXT,
            usd_final_profit NUMBER,
            actual_profit NUMBER,
            actual_usd_profit NUMBER,
            failed_message TEXT,
            reserved_base_coin NUMBER,
            reserved_second_coin NUMBER,
            trailing_deviation NUMBER,
            trailing_max_price NUMBER,
            tsl_max_price NUMBER,
            strategy TEXT,
            reserved_quote_funds TEXT,
            reserved_base_funds TEXT,
            realized_actual_profit_usd NUMBER,
            deal_hours NUMBER,
            currency TEXT,
            max_deal_funds NUMBER,
            profitPercent NUMBER,
            impactFactor NUMBER,
            profile_id VARCHAR(36)
            )`);

    stmt.run();

}

function initializeAccountTable() {
    const stmt = db.prepare(`
        CREATE TABLE accountData (
            id TEXT PRIMARY KEY UNIQUE,
            account_id NUMBER,
            account_name TEXT,
            exchange_name TEXT,
            currency_code TEXT,
            percentage NUMBER,
            position NUMBER,
            on_orders NUMBER,
            btc_value NUMBER,
            usd_value NUMBER,
            market_code TEXT,
            profile_id VARCHAR(36)
            )`);

    stmt.run();

}

function initialDatabaseSetup() {
    initializeDealTable();
    initializeAccountTable();
    initializeBotsTable();
}


async function checkOrMakeTables() {

    // checking if the tables exist.
    const existingTables = await query("SELECT name FROM sqlite_master WHERE type='table';")

    if (existingTables.length == 0) {
        initialDatabaseSetup()
        return
    }

    const tableNames = existingTables.map(table => table.name)
    if (!tableNames.includes('deals')) initializeDealTable()
    if (!tableNames.includes('accountData')) initializeAccountTable()
    if (!tableNames.includes('bots')) initializeBotsTable()
}



function normalizeData(data: any) {
    let valueString;
    if (typeof data == 'string') {
        valueString = data.replaceAll('?', '')
    } else if (typeof data == 'boolean') {
        valueString = (data) ? 1 : 0;
    } else {
        valueString = data
    }
    return valueString;
}


/********************************************
 * 
 *        Database Action Commands
 * 
 ********************************************/

/**
 * 
 * @param {object} data Array of Objects. 
 * @param {string} tableName valid table name for the sqlite database
 * 
 * @description Inserting data into a table. Data coming in needs to be an array of objects.
 */
async function update(table: string, data: any[], profileId:string) {

    if (data.length == 0) {
        log.log('no data to write')
        return false
    }

    let normalizedData = data.map(row => {
        let newRow: any = {};
        Object.keys(row).forEach(item => {
            newRow[normalizeData(item)] = normalizeData(row[item])
        })
        newRow["profile_id"] = profileId;
        return newRow
    })


    const KEYS = Object.keys(normalizedData[0]).map(e => normalizeData(e)).join()
    const valueKey = Object.keys(normalizedData[0]).map(key => '@' + key).map(e => normalizeData(e)).join()



    const statement = db.prepare(`INSERT OR REPLACE INTO ${table} (${KEYS}) VALUES (${valueKey})`)

    const insertMany = db.transaction((dataArray) => {
        for (const row of dataArray) {
            statement.run(row)
        }
    });

    await insertMany(normalizedData)
}

async function upsert(table: string, data: any[], id: string, updateColumn: string) {

    if (data.length == 0) {
        log.log('no data to write')
        return false
    }

    // removing any inconsistencies with how sqlite handles the data.
    let normalizedData = data.map(row => {
        let newRow: any = {};
        Object.keys(row).forEach(item => {
            newRow[normalizeData(item)] = normalizeData(row[item])
        })
        return newRow
    })


    // const KEYS = Object.keys(normalizedData[0]).map(e => normalizeData(e)).join()
    // const valueKey = Object.keys(normalizedData[0]).map(key => '@' + key).map(e => normalizeData(e)).join()

    const insertMany = db.transaction((dataArray) => {
        for (const row of dataArray) {
            const statement = db.prepare(`UPDATE ${table} SET ${updateColumn} = ${row[updateColumn]} where ${id} = ${row[id]} AND profile_id = '${config.get('current')}';`)
            statement.run(row)
        }
    });

    await insertMany(normalizedData)
}

/**
 * 
 * @param {string} query The full query string for the information.
 * @returns JSON array of objects containing the matching information.
 * 
 * @docs - https://github.com/JoshuaWise/better-sqlite3/blob/HEAD/docs/api.md#allbindparameters---array-of-rows
 * 
 * ### TODO 
 * - Can add the ability to set custom filters to be returned. Not sure the exact benefit of this but it's possible.
 */
async function query(query: string) {
    const row = await db.prepare(query)
    return await row.all()
}

async function run(query: string) {
    const stmt = db.prepare(query);
    await stmt.run()
}

async function deleteAllData(profileID?: string) {

    if (!profileID) {
        // truncating the table
        await run(`DELETE FROM bots;'`)
        await run(`DELETE FROM accountData;`)
        await run(`DELETE FROM deals;'`)
        log.info('deleting all database info.')
    }
    log.info('deleting all database info.')
    await run(`DELETE
               FROM bots
               WHERE profile_id = '${profileID}'`)
    await run(`DELETE
               FROM accountData
               WHERE profile_id = '${profileID}'`)
    await run(`DELETE
               FROM deals
               WHERE profile_id = '${profileID}'`)
    log.info('database info deleted.')

}


export {
    update,
    query,
    run,
    checkOrMakeTables,
    deleteAllData,
    upsert
}
