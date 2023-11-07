export interface Transfer {
    from: string, to:string, amount:number, count?:number,
}

export class TransferFlow extends Array<Transfer> {
    constructor(transfers?: Transfer[]) {
        super(...(transfers || []))

        if (!this._validateLinking()) {
            throw new Error("bad transfer flow")
        }
    }

    last(): Transfer | undefined {
        if (this.length > 0) {
            return this[this.length-1]
        }
    }

    private _validateLinking(): boolean {
        let efrom = this[0]?.from
        for (const t of this) {
            if (efrom != t.from) {
                return false
            }
            efrom = t.to
        }
        return true
    }
}