const DEFAULT_MAX_BOXES = 250;
const EPSILON = 0.000001;

function round(value, decimals = 3) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function positiveNumber(value, fieldName) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    const error = new Error(`${fieldName} must be a positive number.`);
    error.statusCode = 400;
    throw error;
  }
  return number;
}

function optionalPositiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function itemWeight(item) {
  const quantity = Number.isFinite(Number(item.quantity)) ? Number(item.quantity) : 1;
  const unitWeight = optionalPositiveNumber(item.unit_weight_kg ?? item.weight_kg) || 0;
  return quantity * unitWeight;
}

function normalizeTruck(payload = {}) {
  const source = payload.truck_dimensions || payload.truck || payload.container || payload;
  return {
    length_m: positiveNumber(source.length_m, "truck length_m"),
    width_m: positiveNumber(source.width_m, "truck width_m"),
    height_m: positiveNumber(source.height_m, "truck height_m"),
    max_weight_kg: optionalPositiveNumber(
      source.max_weight_kg ?? source.capacity_kg ?? payload.truck_capacity_kg
    )
  };
}

function normalizeCargoItems(payload = {}) {
  return payload.cargo_items || payload.cargo || payload.items || [];
}

function normalizeDimensions(item, index) {
  const dimensions = item.dimensions_m || item.dimensions || {};
  return {
    length_m: positiveNumber(item.length_m ?? dimensions.length_m, `cargo item ${index + 1} length_m`),
    width_m: positiveNumber(item.width_m ?? dimensions.width_m, `cargo item ${index + 1} width_m`),
    height_m: positiveNumber(item.height_m ?? dimensions.height_m, `cargo item ${index + 1} height_m`)
  };
}

function expandBoxes(items) {
  const boxes = [];

  items.forEach((item, itemIndex) => {
    const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1));
    const dimensions = normalizeDimensions(item, itemIndex);
    const weightKg = positiveNumber(
      item.unit_weight_kg ?? item.weight_kg ?? item.total_weight_kg,
      `cargo item ${itemIndex + 1} weight_kg`
    );

    for (let unitIndex = 0; unitIndex < quantity; unitIndex += 1) {
      boxes.push({
        box_id: `${item.sku || `BOX-${itemIndex + 1}`}-${String(unitIndex + 1).padStart(3, "0")}`,
        source_item: item.name || item.sku || `Cargo item ${itemIndex + 1}`,
        sku: item.sku || null,
        length_m: dimensions.length_m,
        width_m: dimensions.width_m,
        height_m: dimensions.height_m,
        weight_kg: weightKg,
        fragile: Boolean(item.fragile),
        heavy: Boolean(item.heavy) || weightKg >= 500,
        hazardous: Boolean(item.hazardous),
        damaged: Boolean(item.damaged),
        temperature_sensitive: Boolean(item.temperature_sensitive),
        stack_position: item.stack_position || "unplanned",
        stack_group: item.stack_group || "main"
      });
    }
  });

  if (boxes.length > DEFAULT_MAX_BOXES) {
    const error = new Error(
      `Load planner accepts up to ${DEFAULT_MAX_BOXES} physical boxes per request. Received ${boxes.length}.`
    );
    error.statusCode = 400;
    throw error;
  }

  return boxes;
}

function overlaps(a, b) {
  return (
    a.x < b.x + b.length_m - EPSILON &&
    a.x + a.length_m > b.x + EPSILON &&
    a.y < b.y + b.width_m - EPSILON &&
    a.y + a.width_m > b.y + EPSILON &&
    a.z < b.z + b.height_m - EPSILON &&
    a.z + a.height_m > b.z + EPSILON
  );
}

function overlapAreaOnFloor(a, b) {
  const xOverlap = Math.max(
    0,
    Math.min(a.x + a.length_m, b.x + b.length_m) - Math.max(a.x, b.x)
  );
  const yOverlap = Math.max(
    0,
    Math.min(a.y + a.width_m, b.y + b.width_m) - Math.max(a.y, b.y)
  );
  return xOverlap * yOverlap;
}

function supportedBy(candidate, placements) {
  if (candidate.z <= EPSILON) return { supported: true, supports: [] };

  const supports = placements.filter(
    (placement) =>
      Math.abs(placement.z + placement.height_m - candidate.z) < EPSILON &&
      overlapAreaOnFloor(candidate, placement) > EPSILON
  );
  const supportedArea = supports.reduce(
    (sum, placement) => sum + overlapAreaOnFloor(candidate, placement),
    0
  );
  const requiredArea = candidate.length_m * candidate.width_m * 0.62;

  return {
    supported: supportedArea + EPSILON >= requiredArea,
    supports
  };
}

function inBounds(candidate, truck) {
  return (
    candidate.x >= -EPSILON &&
    candidate.y >= -EPSILON &&
    candidate.z >= -EPSILON &&
    candidate.x + candidate.length_m <= truck.length_m + EPSILON &&
    candidate.y + candidate.width_m <= truck.width_m + EPSILON &&
    candidate.z + candidate.height_m <= truck.height_m + EPSILON
  );
}

function createCandidateEdges(placements) {
  const xs = new Set([0]);
  const ys = new Set([0]);
  const zs = new Set([0]);

  placements.forEach((placement) => {
    xs.add(round(placement.x + placement.length_m));
    ys.add(round(placement.y + placement.width_m));
    zs.add(round(placement.z + placement.height_m));
  });

  return {
    xs: [...xs].sort((a, b) => a - b),
    ys: [...ys].sort((a, b) => a - b),
    zs: [...zs].sort((a, b) => a - b)
  };
}

function summarizeWeight(placements, nextPlacement, truck) {
  const all = nextPlacement ? [...placements, nextPlacement] : placements;
  const totals = all.reduce(
    (acc, placement) => {
      const centerX = placement.x + placement.length_m / 2;
      const centerY = placement.y + placement.width_m / 2;
      if (centerY <= truck.width_m / 2) acc.left_kg += placement.weight_kg;
      else acc.right_kg += placement.weight_kg;
      if (centerX <= truck.length_m / 2) acc.front_kg += placement.weight_kg;
      else acc.rear_kg += placement.weight_kg;
      acc.total_kg += placement.weight_kg;
      acc.weighted_x += centerX * placement.weight_kg;
      acc.weighted_y += centerY * placement.weight_kg;
      acc.weighted_z += (placement.z + placement.height_m / 2) * placement.weight_kg;
      return acc;
    },
    {
      left_kg: 0,
      right_kg: 0,
      front_kg: 0,
      rear_kg: 0,
      total_kg: 0,
      weighted_x: 0,
      weighted_y: 0,
      weighted_z: 0
    }
  );

  const total = totals.total_kg || 1;
  return {
    ...totals,
    lateral_imbalance_ratio: Math.abs(totals.left_kg - totals.right_kg) / total,
    longitudinal_imbalance_ratio: Math.abs(totals.front_kg - totals.rear_kg) / total,
    center_of_gravity_m: {
      x: round(totals.weighted_x / total),
      y: round(totals.weighted_y / total),
      z: round(totals.weighted_z / total)
    }
  };
}

function placementScore(candidate, placements, truck) {
  const weight = summarizeWeight(placements, candidate, truck);
  const heightPenalty = candidate.z / truck.height_m;
  const lengthPenalty = candidate.x / truck.length_m;
  const sidePenalty = Math.abs(candidate.y + candidate.width_m / 2 - truck.width_m / 2) / truck.width_m;
  return (
    weight.lateral_imbalance_ratio * 7 +
    weight.longitudinal_imbalance_ratio * 5 +
    heightPenalty * 2 +
    lengthPenalty +
    sidePenalty * 0.4
  );
}

function orientationsFor(box) {
  const orientations = [
    {
      length_m: box.length_m,
      width_m: box.width_m,
      height_m: box.height_m
    }
  ];

  if (Math.abs(box.length_m - box.width_m) > EPSILON) {
    orientations.push({
      length_m: box.width_m,
      width_m: box.length_m,
      height_m: box.height_m
    });
  }

  return orientations;
}

function findBestPlacement(box, placements, truck) {
  const edges = createCandidateEdges(placements);
  let best = null;

  for (const orientation of orientationsFor(box)) {
    for (const z of edges.zs) {
      for (const x of edges.xs) {
        for (const y of edges.ys) {
          const candidate = {
            ...box,
            ...orientation,
            x,
            y,
            z
          };

          if (!inBounds(candidate, truck)) continue;
          if (placements.some((placement) => overlaps(candidate, placement))) continue;

          const support = supportedBy(candidate, placements);
          if (!support.supported) continue;

          const score = placementScore(candidate, placements, truck);
          if (!best || score < best.score) {
            best = {
              ...candidate,
              score,
              supported_by: support.supports.map((placement) => placement.box_id)
            };
          }
        }
      }
    }
  }

  return best;
}

function createWarnings({ boxes, placements, unplaced, truck, balance, fragileStackingWarnings }) {
  const warnings = [];
  const requestedWeight = boxes.reduce((sum, box) => sum + box.weight_kg, 0);

  if (unplaced.length > 0) {
    warnings.push(`${unplaced.length} box(es) could not fit inside the truck dimensions.`);
  }

  if (truck.max_weight_kg && requestedWeight > truck.max_weight_kg) {
    warnings.push(
      `Total cargo weight ${round(requestedWeight, 1)} kg exceeds truck capacity ${round(truck.max_weight_kg, 1)} kg.`
    );
  }

  if (balance.lateral_imbalance_ratio >= 0.25) {
    warnings.push(
      `Left/right load imbalance is ${round(balance.lateral_imbalance_ratio * 100, 1)} percent.`
    );
  }

  if (balance.longitudinal_imbalance_ratio >= 0.25) {
    warnings.push(
      `Front/rear load imbalance is ${round(balance.longitudinal_imbalance_ratio * 100, 1)} percent.`
    );
  }

  if (fragileStackingWarnings.length > 0) {
    warnings.push(...fragileStackingWarnings);
  }

  if (placements.some((placement) => placement.hazardous)) {
    warnings.push("Hazardous cargo is present; validate segregation, labels, and documents before dispatch.");
  }

  if (placements.some((placement) => placement.temperature_sensitive)) {
    warnings.push("Temperature-sensitive cargo is present; confirm reefer settings before dispatch.");
  }

  return [...new Set(warnings)];
}

function findFragileStackingWarnings(placements) {
  const warnings = [];

  placements.forEach((upper) => {
    if (!upper.heavy && upper.weight_kg < 500) return;
    const lowerSupports = placements.filter(
      (lower) =>
        lower.fragile &&
        Math.abs(lower.z + lower.height_m - upper.z) < EPSILON &&
        overlapAreaOnFloor(upper, lower) > EPSILON
    );

    lowerSupports.forEach((lower) => {
      warnings.push(`${upper.box_id} is heavy and placed above fragile box ${lower.box_id}.`);
    });
  });

  return warnings;
}

export function createLoadPlan(payload = {}) {
  const truck = normalizeTruck(payload);
  const boxes = expandBoxes(normalizeCargoItems(payload));
  const placements = [];
  const unplaced = [];

  const sortedBoxes = [...boxes].sort((a, b) => {
    if (a.fragile !== b.fragile) return a.fragile ? 1 : -1;
    if (a.heavy !== b.heavy) return a.heavy ? -1 : 1;
    const volumeA = a.length_m * a.width_m * a.height_m;
    const volumeB = b.length_m * b.width_m * b.height_m;
    return volumeB - volumeA || b.weight_kg - a.weight_kg;
  });

  sortedBoxes.forEach((box) => {
    const placement = findBestPlacement(box, placements, truck);
    if (!placement) {
      unplaced.push({
        box_id: box.box_id,
        source_item: box.source_item,
        reason: "No collision-free position fits within truck bounds with enough floor/support area.",
        length_m: box.length_m,
        width_m: box.width_m,
        height_m: box.height_m,
        weight_kg: box.weight_kg
      });
      return;
    }

    const { score, ...withoutScore } = placement;
    placements.push({
      ...withoutScore,
      x: round(withoutScore.x),
      y: round(withoutScore.y),
      z: round(withoutScore.z),
      length_m: round(withoutScore.length_m),
      width_m: round(withoutScore.width_m),
      height_m: round(withoutScore.height_m),
      weight_kg: round(withoutScore.weight_kg, 1)
    });
  });

  const placedVolume = placements.reduce(
    (sum, placement) => sum + placement.length_m * placement.width_m * placement.height_m,
    0
  );
  const requestedVolume = boxes.reduce(
    (sum, box) => sum + box.length_m * box.width_m * box.height_m,
    0
  );
  const truckVolume = truck.length_m * truck.width_m * truck.height_m;
  const placedWeight = placements.reduce((sum, placement) => sum + placement.weight_kg, 0);
  const requestedWeight = boxes.reduce((sum, box) => sum + box.weight_kg, 0);
  const balance = summarizeWeight(placements, null, truck);
  const fragileStackingWarnings = findFragileStackingWarnings(placements);
  const warnings = createWarnings({
    boxes,
    placements,
    unplaced,
    truck,
    balance,
    fragileStackingWarnings
  });

  const status = unplaced.length > 0 || warnings.length > 0 ? "Needs review" : "Load plan feasible";

  return {
    status,
    generated_by: "Deterministic rectangular bin-packing planner",
    assumptions: [
      "Boxes are rectangular and axis-aligned.",
      "Boxes may rotate on the floor plane, but are not tilted.",
      "A stacked box requires at least 62 percent footprint support from boxes directly below.",
      "This planner produces a feasibility plan; a human supervisor must still verify real dock constraints."
    ],
    truck: {
      ...truck,
      volume_m3: round(truckVolume, 2)
    },
    box_count_requested: boxes.length,
    placed_box_count: placements.length,
    unplaced_box_count: unplaced.length,
    requested_weight_kg: round(requestedWeight, 1),
    placed_weight_kg: round(placedWeight, 1),
    requested_volume_m3: round(requestedVolume, 2),
    placed_volume_m3: round(placedVolume, 2),
    volume_utilization: round(placedVolume / truckVolume, 3),
    weight_utilization: truck.max_weight_kg ? round(requestedWeight / truck.max_weight_kg, 3) : null,
    balance: {
      left_kg: round(balance.left_kg, 1),
      right_kg: round(balance.right_kg, 1),
      front_kg: round(balance.front_kg, 1),
      rear_kg: round(balance.rear_kg, 1),
      lateral_imbalance_ratio: round(balance.lateral_imbalance_ratio, 3),
      longitudinal_imbalance_ratio: round(balance.longitudinal_imbalance_ratio, 3),
      center_of_gravity_m: balance.center_of_gravity_m
    },
    placements,
    unplaced,
    warnings
  };
}
