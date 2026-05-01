export function filterByRange(groups, range) {
    if (!range || range === 'all') return groups
  
    return groups.map(g => ({
      ...g,
      atms: g.atms.filter(a => {
        if (range === 'low') return a.consumption < 30
        if (range === 'mid') return a.consumption >= 30 && a.consumption <= 50
        if (range === 'high') return a.consumption > 50
      })
    }))
  }