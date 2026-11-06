function substitutionBatchEvents(body) {
    const pairs = body.pairs || body.details?.pairs;
    const batchId = body.local_event_id;
    if (!Array.isArray(pairs) || !pairs.length || pairs.length > 6 || typeof batchId !== 'string' || batchId.length > 100) throw Object.assign(Error('Invalid substitution batch'), { status: 400 });
    const ins = new Set(), outs = new Set();
    return pairs.map((pair, index) => {
        const incoming = Number(pair.in), outgoing = Number(pair.out);
        if (![incoming, outgoing].every(value => Number.isSafeInteger(value) && value > 0) || incoming === outgoing || ins.has(incoming) || outs.has(outgoing)) throw Object.assign(Error('Invalid or duplicate substitution players'), { status: 400 });
        ins.add(incoming); outs.add(outgoing);
        if ([...ins].some(value => outs.has(value))) throw Object.assign(Error('A player cannot enter and leave in the same batch'), { status: 400 });
        return { ...body, event_type: 'SUBSTITUTION', player_id: incoming, local_event_id: `${batchId}:${index}`,
            details: { out: outgoing, isExceptional: false, batchLocalEventId: batchId, batchSize: pairs.length, batchIndex: index,
                lineups: body.lineups || body.details?.lineups, isHomeLeft: body.isHomeLeft ?? body.details?.isHomeLeft } };
    });
}
module.exports = { substitutionBatchEvents };
