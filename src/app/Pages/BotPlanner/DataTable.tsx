import React, { useState, useEffect, useMemo } from 'react';
import { Switch, Checkbox } from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';
import styled from 'styled-components'

import { useAppSelector } from '@/app/redux/hooks';
import { storageItem } from '@/app/Features/LocalStorage/LocalStorage';

import {formatCurrency} from'@/utils/granularity'

import { parseNumber } from '@/utils/number_formatting';
import {
  calc_deviation,
  calc_DealMaxFunds_bot,
  calc_maxInactiveFunds,
  calc_maxBotFunds,
  calc_dropMetrics
} from '@/utils/formulas';

import { Type_Query_bots } from '@/types/3Commas'

import { CustomTable } from '@/app/Components/DataTable/Index'

const Styles = styled.div`
  overflow: auto;

  table {
    border-spacing: 0;
    background-color: var(--color-background-light);
    color: var(--color-text-lightbackground);
    font-size: .875em;
    min-width: 1200px;
    width: 100%;

    th,
    td {
      margin: 0;
    };

    th {
      position: sticky;
      top: 0;
      z-index: 100;
      height: 44px;
      background-color: var(--color-secondary-light87);
      font-family: "Open Sans", sans-serif;
      font-size: .875em;
      padding: 0 .5em;

  }

    thead {

      
    }

    
    tbody{

      input {
        font-size: .875rem;
        padding: 0;
        margin: 0;
        border: 0;
        background-color: var(--color-background-light);
        color: var(--color-text-lightbackground);
      }

        tr {
            :nth-child(2n+2) {
                background-color: var(--color-secondary-light87);

                input {
                  background-color: var(--color-secondary-light87);
                }
            }
    
            :hover {
              input {
                background-color: var(--color-secondary-light25);
                color: var(--color-text-darkbackground);
              }
                background-color: var(--color-secondary-light25);
                color: var(--color-text-darkbackground);
            }
        };

        }
    }

    
  }
`

interface Cell {
  value: {
    initialValue: string
  }
  row: {
    original: Type_Query_bots,
  }
  column: {
    id: string
  }
  updateLocalBotData: any
}

// Create an editable cell renderer
const EditableCell = ({
  value: initialValue,
  row: { original },
  column: { id: column },
  updateLocalBotData, // This is a custom function that we supplied to our table instance
}: Cell) => {
  // We need to keep and update the state of the cell normally
  const [value, setValue] = useState(String(initialValue))
  const [size, setSize] = useState(() => String(initialValue).length * 1.5)

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value)
    setSize(e.target.value.length)

  }

  // We'll only update the external data when the input is blurred
  const onBlur = () => {
    updateLocalBotData(original.id, column, value, original)
  }

  const ending = () => {
    if (column == 'safety_order_volume' || column == 'base_order_volume') {
      return ''
    } else if (column == 'take_profit') {
      return <span>%</span>
    } else if (column == 'max_safety_orders') {
      return <span> SOs</span>
    }
  }

  useEffect(() => {
    setSize(String(value).length * 1.5)
  }, [value, initialValue])

  // If the initialValue is changed external, sync it up with our state
  useEffect(() => {
    setValue(String(initialValue))
  }, [initialValue])

  return <span style={{ display: 'flex', justifyContent: 'center' }}><input value={value} onChange={onChange} onBlur={onBlur} size={size} style={{ textAlign: 'center' }} />{ending()}</span>
}

interface Type_DataTable {
  localBotData: Type_Query_bots[]
  updateLocalBotData: any
}
const DataTable = ({ localBotData, updateLocalBotData }: Type_DataTable) => {
  const localStorageSortName = storageItem.tables.BotPlanner.sort;

  const { metricsData: {totalBankroll}} = useAppSelector(state => state.threeCommas);

  // handling this locally because it does not need to be saved yet.
  const handleOnOff = (e: any) => {
    updateLocalBotData((prevState: Type_Query_bots[]) => {
      const newRows = prevState.map((row: Type_Query_bots) => {

        if (e != undefined && e.target !== null) {
          if (e.target.name == row.id) {
            row.is_enabled = (row.is_enabled == 1) ? 0 : 1;
          }
        }
        return row
      })
      return calc_dropMetrics(totalBankroll, newRows)
    })

  }

  const handleDeleteRow = (cellId: number) => {
    updateLocalBotData((prevState: Type_Query_bots[]) => {
      const newRows = prevState.filter(row => {
        if (cellId !== row.id) {
          return row
        }
      })
      return calc_dropMetrics(totalBankroll, newRows)
    })

  }


  const handleEditCellChangeCommitted = (id: number, column: string, value: string | boolean) => {
    updateLocalBotData((prevState: Type_Query_bots[]) => {
      const newRows = prevState.map(row => {
        if (id == row.id) {

          // @ts-ignore - validate props
          row[column] = value

          /**
           * TODO
           * - If it's worth it, find out what row was updated and then calculate the below metrics. There may be a few rows that we don't have to recalc metrics for.
           */

          const { max_safety_orders, base_order_volume, safety_order_volume,
            martingale_volume_coefficient, martingale_step_coefficient, max_active_deals,
            active_deals_count, safety_order_step_percentage } = row

          let maxDealFunds = calc_DealMaxFunds_bot(+max_safety_orders, base_order_volume, safety_order_volume, martingale_volume_coefficient)
          let max_inactive_funds = calc_maxInactiveFunds(+maxDealFunds, +max_active_deals, +active_deals_count)
          row.max_funds = calc_maxBotFunds(+maxDealFunds, +max_active_deals)
          row.max_funds_per_deal = maxDealFunds;
          row.max_inactive_funds = max_inactive_funds;
          row.price_deviation = calc_deviation(+max_safety_orders, +safety_order_step_percentage, +martingale_step_coefficient)

        }
        return row
      })

      return calc_dropMetrics(totalBankroll, newRows)


    })
  }


  const columns = useMemo(
    () => [
      {
        Header: 'Enabled?',
        accessor: 'is_enabled',
        Cell: ({ cell }: any) => {
          return <Switch
            checked={cell.value === 1 || cell.value === true}
            color="primary"
            onClick={handleOnOff}
            name={cell.row.original.id}
            inputProps={{ 'aria-label': 'secondary checkbox' }}
          />
        }
      },
      {
        Header: 'Hide?',
        accessor: 'hide',
        Cell: ({ cell }: any) => {
          return <Checkbox
            checked={cell.value === 1 || cell.value === true}
            onChange={() => handleEditCellChangeCommitted(cell.row.original.id, 'hide', !cell.value)}
            name="summary"
            style={{ color: 'var(--color-secondary)' }}

          />
        }
      },
      {
        Header: 'Name',
        accessor: 'name',
        Cell: EditableCell,
        style: {
          textAlign: 'center',
          paddingLeft: '1em'
        }
      },
      {
        Header: 'Pairs',
        accessor: 'pairs',
        style: {
          textAlign: 'center'
        },
        Cell: ({ cell }: any) => {
          if (cell.value.length > 20) {
            return 'Many'
          }

          return cell.value
        }
      },
      {
        Header: 'Currency',
        accessor: 'from_currency',
        className:"monospace-cell",
        style: {
          textAlign: 'center'
        }
      },
      {
        Header: 'BO',
        accessor: 'base_order_volume',
        Cell: EditableCell,
        className:"monospace-cell",
        style: {
          textAlign: 'center'
        }
      },
      {
        Header: 'SO',
        accessor: 'safety_order_volume',
        Cell: EditableCell,
        className:"monospace-cell",
        style: {
          textAlign: 'center'
        }
      },
      {
        Header: 'Take Profit',
        accessor: 'take_profit',
        Cell: EditableCell,
        className:"monospace-cell",
        style: {
          textAlign: 'center'
        }
      },
      {
        Header: 'MSTC',
        accessor: 'max_safety_orders',
        Cell: EditableCell,
        className:"monospace-cell",
        style: {
          textAlign: 'center'
        }
      },
      {
        Header: 'SOS',
        accessor: 'safety_order_step_percentage',
        Cell: EditableCell,
        className:"monospace-cell",
        style: {
          textAlign: 'center'
        }
      },
      {
        Header: 'OS',
        accessor: 'martingale_volume_coefficient',
        Cell: EditableCell,
        className:"monospace-cell",
        style: {
          textAlign: 'center'
        }
      },
      {
        Header: 'SS',
        accessor: 'martingale_step_coefficient',
        Cell: EditableCell,
        className:"monospace-cell",
        style: {
          textAlign: 'center'
        }
      },
      {
        Header: 'Deals',
        accessor: 'max_active_deals',
        className:"monospace-cell",
        style: {
          textAlign: 'center'
        }
      },
      {
        Header: 'Deviation',
        accessor: 'price_deviation',
        Cell: ({ cell }: any) => <span className="monospace-cell">{cell.value}%</span>,
        style: {
          textAlign: 'center'
        }
      },
      {
        Header: 'Deal Funds',
        accessor: 'max_funds_per_deal',
        Cell: ({ cell }: any) => < span className=" monospace-cell">{formatCurrency( [cell.row.original.from_currency], cell.value, true).metric}</span>,
        style: {
          textAlign: 'center'
        }

      },
      {
        Header: 'Bot Funds',
        accessor: 'max_funds',
        Cell: ({ cell }: any) =>  < span className=" monospace-cell">{formatCurrency( [cell.row.original.from_currency], cell.value, true).metric}</span>,
        style: {
          textAlign: 'center'
        }
      },

      {
        Header: 'Coverage',
        accessor: 'maxCoveragePercent',
        Cell: ({ cell }: any) => <span className="monospace-cell">{cell.value}%</span>,
        style: {
          textAlign: 'center'
        }
      },
      {
        Header: 'Risk %',
        accessor: 'riskPercent',
        Cell: ({ cell }: any) => <span className="monospace-cell">{parseNumber(cell.value * 100)}%</span>,
        style: {
          textAlign: 'center'
        }
      },
      {
        Header: 'Max SO Covered',
        accessor: 'maxSoReached',
        className:"monospace-cell",
        style: {
          textAlign: 'center',
          width: '2em',
          maxWidth: '5em'
        }
      },
      {
        Header: () => <DeleteIcon />,
        accessor: 'origin',
        Cell: ({ cell }: any) => {
          if (cell.value === 'custom') {
            return (
              <DeleteIcon
                onClick={() => handleDeleteRow(cell.row.original.id)}
              />
            )
          }
          return (<></>)
        }
      }



    ],
    []
  )


  return (

      <div className="boxData flex-column" style={{padding: '1em', overflow: 'hidden'}}>
        <Styles>
          <CustomTable
            columns={columns}
            data={localBotData}
            autoResetSortBy={false}
            // autoResetPage={false}
            manualSortBy={true}
            updateLocalBotData={handleEditCellChangeCommitted}
            localStorageSortName={localStorageSortName}
            //@ts-ignore
            getHeaderProps={column => ({
              

            })}
            //@ts-ignore
            getColumnProps={column => ({

            })}
            //@ts-ignore
            getRowProps={row => ({

            })}
            //@ts-ignore
            getCellProps={cellInfo => ({

            })}
          />
        </Styles>
      {/* </div> */}
    </div>

  );
}




export default DataTable;
