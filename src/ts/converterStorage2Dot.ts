import { Storage, Variable, StorageType } from './converterClasses2Storage'

const debug = require('debug')('sol2uml')

export const convertStorages2Dot = (storages: Storage[]): string => {
    let dotString: string = `
digraph StorageDiagram {
rankdir=LR
color=black
arrowhead=open
node [shape=record, style=filled, fillcolor=gray95]`

    // process contract and the struct storages
    storages.forEach((storage) => {
        dotString = convertStorage2Dot(storage, dotString)
    })

    // link contract and structs to structs
    storages.forEach((slot) => {
        slot.variables.forEach((storage) => {
            if (storage.structStorageId) {
                dotString += `\n ${slot.id}:${storage.id} -> ${storage.structStorageId}`
            }
        })
    })

    // Need to close off the last digraph
    dotString += '\n}'

    debug(dotString)

    return dotString
}

export function convertStorage2Dot(
    storage: Storage,
    dotString: string
): string {
    const steorotype =
        storage.type === StorageType.Struct ? 'Struct' : 'Contract'

    // write storage header with name and optional address
    dotString += `\n${storage.id} [label="${
        storage.name
    } \\<\\<${steorotype}\\>\\>\\n${storage.address || ''} | {`

    const startingVariables = storage.variables.filter(
        (s) => s.byteOffset === 0
    )

    // write slot numbers
    dotString += '{ slot'
    startingVariables.forEach((variable, i) => {
        if (variable.fromSlot === variable.toSlot) {
            dotString += `| ${variable.fromSlot} `
        } else {
            dotString += `| ${variable.fromSlot}-${variable.toSlot} `
        }
    })

    // write slot values if available
    if (startingVariables[0]?.values[0]) {
        dotString += '} | {value'
        startingVariables.forEach((variable, i) => {
            dotString += ` | ${variable.values[0]}`
        })
    }

    const contractVariablePrefix =
        storage.type === StorageType.Contract ? '\\<inherited contract\\>.' : ''
    dotString += `} | { type: ${contractVariablePrefix}variable (bytes)`

    // For each slot
    startingVariables.forEach((variable) => {
        // Get all the storage variables in this slot
        const slotVariables = storage.variables.filter(
            (s) => s.fromSlot === variable.fromSlot
        )
        const usedBytes = slotVariables.reduce((acc, s) => acc + s.byteSize, 0)
        if (usedBytes < 32) {
            slotVariables.push({
                id: 0,
                fromSlot: variable.fromSlot,
                toSlot: variable.fromSlot,
                byteSize: 32 - usedBytes,
                byteOffset: usedBytes,
                type: 'unallocated',
                contractName: variable.contractName,
                variable: '',
                values: [],
            })
        }
        const slotVariablesReversed = slotVariables.reverse()

        // For each variable in the slot
        slotVariablesReversed.forEach((variable, i) => {
            if (i === 0) {
                dotString += ` | { ${dotVariable(variable, storage.name)} `
            } else {
                dotString += ` | ${dotVariable(variable, storage.name)} `
            }
        })
        dotString += '}'
    })

    // Need to close off the last label
    dotString += '}}"]\n'

    return dotString
}

const dotVariable = (storage: Variable, contractName: string): string => {
    const port = storage.structStorageId !== undefined ? `<${storage.id}>` : ''
    const contractNamePrefix =
        storage.contractName !== contractName ? `${storage.contractName}.` : ''

    const variable = storage.variable
        ? `: ${contractNamePrefix}${storage.variable}`
        : ''
    return `${port} ${storage.type}${variable} (${storage.byteSize})`
}