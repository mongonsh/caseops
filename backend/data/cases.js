export const sampleCases = [
  {
    case_id: "LCOPS-1001",
    shipment_id: "SHP-DTW-0142",
    uipath_case_id: "MAESTRO-CASE-8142",
    title: "Retail replenishment pallets",
    truck_type: "26 ft box truck",
    truck_capacity_kg: 10000,
    sla_status: "On track",
    stage: "Dispatch Instruction",
    current_stage: "Dispatch Instruction",
    approval_status: "Auto recommended",
    human_approval_decision: "Not required - low risk",
    final_dispatch_decision: "Dispatch approved",
    cargo_items: [
      {
        sku: "BOX-110",
        name: "Retail cartons",
        quantity: 58,
        unit_weight_kg: 42,
        fragile: false,
        heavy: false,
        stack_position: "middle"
      },
      {
        sku: "PAL-310",
        name: "Mixed dry goods pallets",
        quantity: 5,
        unit_weight_kg: 820,
        fragile: false,
        heavy: false,
        stack_position: "floor"
      },
      {
        sku: "KIT-220",
        name: "Protected electronics kits",
        quantity: 8,
        unit_weight_kg: 38,
        fragile: true,
        heavy: false,
        stack_position: "top"
      }
    ],
    weight_distribution: {
      left_kg: 3420,
      right_kg: 3410,
      front_kg: 3490,
      rear_kg: 3340
    },
    evidence: {
      image_uploaded: true,
      photo_quality: "high",
      photo_url: "/mock/cargo-normal.jpg",
      vision_notes: "Dock photo shows wrapped pallets, clear aisle access, and visible load bars."
    },
    metadata: {
      damaged_cargo_detected: false,
      manual_entry_only: false
    },
    ai_analysis_result:
      "Cargo list and dock evidence match. Load is balanced, below capacity, and fragile cartons are placed above heavier freight.",
    audit_events: [
      {
        timestamp: "2026-06-27T09:00:00+09:00",
        actor: "Warehouse intake",
        event: "Shipment intake submitted"
      },
      {
        timestamp: "2026-06-27T09:02:00+09:00",
        actor: "UiPath Maestro Case",
        event: "Case created and routed to cargo vision review"
      },
      {
        timestamp: "2026-06-27T09:04:00+09:00",
        actor: "Logithon coded AI service",
        event: "Low-risk cargo analysis completed"
      },
      {
        timestamp: "2026-06-27T09:06:00+09:00",
        actor: "Dispatch workflow",
        event: "Dispatch instructions generated"
      }
    ]
  },
  {
    case_id: "LCOPS-1002",
    shipment_id: "SHP-LAX-2088",
    uipath_case_id: "MAESTRO-CASE-2088",
    title: "Industrial equipment transfer",
    truck_type: "53 ft dry van",
    truck_capacity_kg: 20000,
    sla_status: "At risk",
    stage: "Human Supervisor Approval",
    current_stage: "Human Supervisor Approval",
    approval_status: "Pending supervisor",
    human_approval_decision: "Awaiting decision",
    final_dispatch_decision: "Hold for re-balance",
    cargo_items: [
      {
        sku: "PMP-900",
        name: "Industrial pump pallets",
        quantity: 7,
        unit_weight_kg: 1800,
        fragile: false,
        heavy: true,
        stack_position: "floor",
        stack_group: "left-wall"
      },
      {
        sku: "MTR-550",
        name: "Motor crates",
        quantity: 3,
        unit_weight_kg: 1450,
        fragile: false,
        heavy: true,
        stack_position: "floor",
        stack_group: "left-wall"
      },
      {
        sku: "BOX-450",
        name: "Service parts cartons",
        quantity: 20,
        unit_weight_kg: 88,
        fragile: false,
        heavy: false,
        stack_position: "middle"
      }
    ],
    weight_distribution: {
      left_kg: 13920,
      right_kg: 4790,
      front_kg: 11200,
      rear_kg: 7510
    },
    evidence: {
      image_uploaded: true,
      photo_quality: "medium",
      photo_url: "/mock/cargo-imbalance.jpg",
      vision_notes: "Vision review indicates dense pallets are staged against the left wall."
    },
    metadata: {
      damaged_cargo_detected: false,
      manual_entry_only: false
    },
    ai_analysis_result:
      "The shipment is close to truck capacity and has a strong left-side imbalance caused by dense equipment pallets.",
    audit_events: [
      {
        timestamp: "2026-06-27T10:15:00+09:00",
        actor: "Warehouse intake",
        event: "High-weight shipment submitted"
      },
      {
        timestamp: "2026-06-27T10:17:00+09:00",
        actor: "UiPath Maestro Case",
        event: "Case created and SLA timer started"
      },
      {
        timestamp: "2026-06-27T10:21:00+09:00",
        actor: "Logithon coded AI service",
        event: "Weight imbalance risk detected"
      },
      {
        timestamp: "2026-06-27T10:23:00+09:00",
        actor: "UiPath Maestro Case",
        event: "Routed to Action Center supervisor approval"
      }
    ]
  },
  {
    case_id: "LCOPS-1003",
    shipment_id: "SHP-SEA-7731",
    uipath_case_id: "MAESTRO-CASE-7731",
    title: "Fragile lab equipment move",
    truck_type: "20 ft temperature-capable container",
    truck_capacity_kg: 12000,
    sla_status: "Needs attention",
    stage: "Human Supervisor Approval",
    current_stage: "Human Supervisor Approval",
    approval_status: "Approved with conditions",
    human_approval_decision: "Supervisor approved after restack and photo evidence",
    final_dispatch_decision: "Dispatch approved with constraints",
    cargo_items: [
      {
        sku: "LAB-GLS",
        name: "Glass lab instruments",
        quantity: 12,
        unit_weight_kg: 55,
        fragile: true,
        heavy: false,
        stack_position: "bottom",
        stack_group: "bay-3"
      },
      {
        sku: "BAT-880",
        name: "Battery backup units",
        quantity: 4,
        unit_weight_kg: 620,
        fragile: false,
        heavy: true,
        hazardous: true,
        stack_position: "top",
        stack_group: "bay-3"
      },
      {
        sku: "MED-220",
        name: "Temperature-sensitive samples",
        quantity: 9,
        unit_weight_kg: 34,
        fragile: true,
        heavy: false,
        temperature_sensitive: true,
        stack_position: "middle"
      },
      {
        sku: "CR-710",
        name: "Accessory crates",
        quantity: 4,
        unit_weight_kg: 260,
        fragile: false,
        heavy: false,
        stack_position: "floor"
      }
    ],
    weight_distribution: {
      left_kg: 2250,
      right_kg: 2236,
      front_kg: 2600,
      rear_kg: 1886
    },
    evidence: {
      image_uploaded: false,
      photo_quality: "missing",
      vision_notes: "No cargo image was attached during initial review."
    },
    metadata: {
      damaged_cargo_detected: true,
      damage_notes: "One glass crate corner protector is crushed.",
      manual_entry_only: true
    },
    ai_analysis_result:
      "Fragile cargo appears to be placed under heavier battery units. Missing image evidence and exception metadata require human governance.",
    audit_events: [
      {
        timestamp: "2026-06-27T11:05:00+09:00",
        actor: "Warehouse intake",
        event: "Fragile shipment submitted with manual cargo list"
      },
      {
        timestamp: "2026-06-27T11:08:00+09:00",
        actor: "Logithon coded AI service",
        event: "Fragile stacking, hazmat, temperature, and evidence exceptions detected"
      },
      {
        timestamp: "2026-06-27T11:12:00+09:00",
        actor: "UiPath Maestro Case",
        event: "Supervisor approval requested"
      },
      {
        timestamp: "2026-06-27T11:20:00+09:00",
        actor: "Supervisor",
        event: "Approved with conditions: restack, isolate batteries, attach dock photos"
      }
    ]
  }
];
