;; vitality-ledger - Decentralized health metrics and wellness achievement tracking
;;
;; A comprehensive smart contract for recording personal health activities, managing wellness
;; objectives, and registering milestone achievements. Users can securely document their daily
;; health practices including sleep duration, fluid intake, and mental wellness activities.
;; The system computes a dynamic vitality score reflecting progress toward personalized targets
;; and enables milestone recognition through an achievement badge mechanism.

;; Error code definitions
(define-constant fail-unauthorized (err u1001))
(define-constant fail-invalid-metric-type (err u1002))
(define-constant fail-metric-out-of-range (err u1003))
(define-constant fail-objective-missing (err u1004))
(define-constant fail-measurement-exceeds-maximum (err u1005))
(define-constant fail-account-nonexistent (err u1006))
(define-constant fail-badge-previously-earned (err u1007))
(define-constant fail-duplicate-daily-entry (err u1008))

;; Constants for data validation boundaries
(define-constant max-sleep-hours u24)
(define-constant max-hydration-ml u10000)
(define-constant max-meditation-minutes u1440)
(define-constant minimum-vitality-threshold u0)
(define-constant vitality-decay-amount u5)
(define-constant vitality-score-baseline u90)
(define-constant minimum-reduction-depth u10)
(define-constant seconds-in-day u86400)

;; Primary account ledger - stores essential user information
(define-map account-registry
  { principal-id: principal }
  {
    registration-date: uint,
    vitality-index: uint,
    activity-sequence: uint
  }
)

;; Daily activity log - comprehensive metrics per user per date
(define-map activity-log
  { principal-id: principal, metric-date: uint }
  {
    sleep-duration: uint,
    hydration-consumption: uint,
    mindfulness-practice: uint,
    record-timestamp: uint
  }
)

;; Wellness targets - personalized goals per user
(define-map wellness-targets
  { principal-id: principal }
  {
    target-sleep: uint,
    target-hydration: uint,
    target-mindfulness: uint,
    objectives-updated: uint
  }
)

;; Badge registry - achievement tracking per user
(define-map badge-inventory
  { principal-id: principal, badge-identifier: uint }
  {
    achievement-timestamp: uint,
    badge-label: (string-utf8 50)
  }
)

;; Badge specifications - metadata for all possible achievements
(define-map badge-specifications
  { badge-identifier: uint }
  {
    badge-title: (string-utf8 50),
    badge-description: (string-utf8 255),
    badge-type: (string-utf8 20),
    required-threshold: uint
  }
)

;; Initialize user account if not present
(define-private (provision-account-if-absent (account principal))
  (if (is-some (map-get? account-registry { principal-id: account }))
    true
    (begin
      (map-set account-registry
        { principal-id: account }
        {
          registration-date: (unwrap-panic (get-block-info? time u0)),
          vitality-index: u0,
          activity-sequence: u0
        }
      )
      true
    )
  )
)

;; Validate measurement within acceptable bounds
(define-private (bounds-check (metric-category (string-utf8 20)) (reading uint))
  (if (is-eq metric-category u"sleep-duration")
    (and (>= reading u0) (<= reading max-sleep-hours))
    (if (is-eq metric-category u"hydration-consumption")
      (and (>= reading u0) (<= reading max-hydration-ml))
      (if (is-eq metric-category u"mindfulness-practice")
        (and (>= reading u0) (<= reading max-meditation-minutes))
        false
      )
    )
  )
)

;; Compute vitality index from recent performance
(define-private (recompute-vitality-index (account principal))
  (let (
    (account-data (unwrap! (map-get? account-registry { principal-id: account }) u0))
    (objectives (unwrap! (map-get? wellness-targets { principal-id: account }) u0))
    (current-timestamp (unwrap-panic (get-block-info? time u0)))
    (yesterday-date (- current-timestamp seconds-in-day))
    (previous-metrics (map-get? activity-log { principal-id: account, metric-date: yesterday-date }))
  )
    (if (is-some previous-metrics)
      (let (
        (metric-data (unwrap-panic previous-metrics))
        (sleep-compliance (if (> (get target-sleep objectives) u0)
          (if (<= (* u100 (/ (get sleep-duration metric-data) (get target-sleep objectives))) u100)
            (* u100 (/ (get sleep-duration metric-data) (get target-sleep objectives)))
            u100)
          u0))
        (hydration-compliance (if (> (get target-hydration objectives) u0)
          (if (<= (* u100 (/ (get hydration-consumption metric-data) (get target-hydration objectives))) u100)
            (* u100 (/ (get hydration-consumption metric-data) (get target-hydration objectives)))
            u100)
          u0))
        (mindfulness-compliance (if (> (get target-mindfulness objectives) u0)
          (if (<= (* u100 (/ (get mindfulness-practice metric-data) (get target-mindfulness objectives))) u100)
            (* u100 (/ (get mindfulness-practice metric-data) (get target-mindfulness objectives)))
            u100)
          u0))
        (mean-compliance (/ (+ sleep-compliance hydration-compliance mindfulness-compliance) u3))
        (prior-index (get vitality-index account-data))
        (calculated-index (+ (/ prior-index minimum-reduction-depth) (* (/ mean-compliance u100) vitality-score-baseline)))
      )
        (map-set account-registry 
          { principal-id: account }
          (merge account-data { vitality-index: calculated-index })
        )
        calculated-index
      )
      (let (
        (prior-index (get vitality-index account-data))
        (adjusted-index (if (> prior-index vitality-decay-amount) (- prior-index vitality-decay-amount) minimum-vitality-threshold))
      )
        (map-set account-registry 
          { principal-id: account }
          (merge account-data { vitality-index: adjusted-index })
        )
        adjusted-index
      )
    )
  )
)

;; Determine if specified metric threshold is satisfied
(define-private (assess-threshold-attainment (account principal) (metric-category (string-utf8 20)) (reading uint))
  (let (
    (objectives (map-get? wellness-targets { principal-id: account }))
  )
    (if (is-some objectives)
      (let (
        (objective-data (unwrap-panic objectives))
      )
        (if (is-eq metric-category u"sleep-duration")
          (>= reading (get target-sleep objective-data))
          (if (is-eq metric-category u"hydration-consumption")
            (>= reading (get target-hydration objective-data))
            (if (is-eq metric-category u"mindfulness-practice")
              (>= reading (get target-mindfulness objective-data))
              false
            )
          )
        )
      )
      false
    )
  )
)

;; Default account initialization template
(define-private (blank-account-template)
  {
    registration-date: u0,
    vitality-index: u0,
    activity-sequence: u0
  }
)

;; Register achievement badge to user
(define-private (grant-badge-achievement (account principal) (badge-identifier uint) (badge-label (string-utf8 50)) (award-timestamp uint))
  (let (
    (badge-check (map-get? badge-inventory { principal-id: account, badge-identifier: badge-identifier }))
  )
    (if (is-none badge-check)
      (begin
        (map-set badge-inventory
          { principal-id: account, badge-identifier: badge-identifier }
          { 
            achievement-timestamp: award-timestamp,
            badge-label: badge-label
          }
        )
        (ok true)
      )
      (ok true)
    )
  )
)

;; Convert timestamp to normalized daily identifier
(define-private (normalize-timestamp-to-date-id (timestamp uint))
  (let (
    (day-seconds seconds-in-day)
    (days-elapsed (/ timestamp day-seconds))
  )
    (* days-elapsed day-seconds)
  )
)

;; Public Functions

;; Establish personalized wellness objectives
(define-public (configure-wellness-objectives (sleep-target uint) (hydration-target uint) (mindfulness-target uint))
  (let (
    (caller tx-sender)
  )
    (asserts! (provision-account-if-absent caller) fail-unauthorized)
    (asserts! (bounds-check u"sleep-duration" sleep-target) fail-metric-out-of-range)
    (asserts! (bounds-check u"hydration-consumption" hydration-target) fail-measurement-exceeds-maximum)
    (asserts! (bounds-check u"mindfulness-practice" mindfulness-target) fail-measurement-exceeds-maximum)
    (let (
      (account-info (unwrap! (map-get? account-registry { principal-id: caller }) fail-account-nonexistent))
    )
      (map-set wellness-targets
        { principal-id: caller }
        {
          target-sleep: sleep-target,
          target-hydration: hydration-target,
          target-mindfulness: mindfulness-target,
          objectives-updated: (unwrap-panic (get-block-info? time u0))
        }
      )
      (ok true)
    )
  )
)

;; Register all daily health measurements
(define-public (submit-daily-metrics (sleep-hours uint) (water-consumed uint) (meditation-duration uint))
  (let (
    (caller tx-sender)
    (current-moment (unwrap-panic (get-block-info? time u0)))
    (normalized-date (normalize-timestamp-to-date-id current-moment))
  )
    (asserts! (provision-account-if-absent caller) fail-unauthorized)
    (asserts! (bounds-check u"sleep-duration" sleep-hours) fail-metric-out-of-range)
    (asserts! (bounds-check u"hydration-consumption" water-consumed) fail-measurement-exceeds-maximum)
    (asserts! (bounds-check u"mindfulness-practice" meditation-duration) fail-measurement-exceeds-maximum)
    (asserts! (is-none (map-get? activity-log { principal-id: caller, metric-date: normalized-date })) fail-duplicate-daily-entry)
    (map-set activity-log
      { principal-id: caller, metric-date: normalized-date }
      {
        sleep-duration: sleep-hours,
        hydration-consumption: water-consumed,
        mindfulness-practice: meditation-duration,
        record-timestamp: current-moment
      }
    )
    (let (
      (updated-index (recompute-vitality-index caller))
    )
      (ok updated-index)
    )
  )
)

;; Adjust individual metric value
(define-public (revise-single-measurement (metric-type (string-utf8 20)) (updated-value uint))
  (let (
    (caller tx-sender)
    (current-moment (unwrap-panic (get-block-info? time u0)))
    (normalized-date (normalize-timestamp-to-date-id current-moment))
  )
    (asserts! (provision-account-if-absent caller) fail-unauthorized)
    (asserts! (bounds-check metric-type updated-value) fail-metric-out-of-range)
    (let (
      (existing-entry (unwrap! (map-get? activity-log { principal-id: caller, metric-date: normalized-date }) fail-objective-missing))
    )
      (if (is-eq metric-type u"sleep-duration")
        (map-set activity-log
          { principal-id: caller, metric-date: normalized-date }
          (merge existing-entry { sleep-duration: updated-value })
        )
        (if (is-eq metric-type u"hydration-consumption")
          (map-set activity-log
            { principal-id: caller, metric-date: normalized-date }
            (merge existing-entry { hydration-consumption: updated-value })
          )
          (if (is-eq metric-type u"mindfulness-practice")
            (map-set activity-log
              { principal-id: caller, metric-date: normalized-date }
              (merge existing-entry { mindfulness-practice: updated-value })
            )
            (err fail-invalid-metric-type)
          )
        )
      )
      (ok true)
    )
  )
)

;; Retrieve user account information and metrics
(define-read-only (query-account-profile (target principal))
  (map-get? account-registry { principal-id: target })
)

;; Fetch historical metrics by date
(define-read-only (fetch-activity-metrics (target principal) (query-date uint))
  (map-get? activity-log { principal-id: target, metric-date: query-date })
)

;; Access user's collected badges
(define-read-only (enumerate-earned-badges (target principal))
  (let (
    (result (list))
  )
    result
  )
)

;; Query personal wellness targets
(define-read-only (retrieve-wellness-targets (target principal))
  (map-get? wellness-targets { principal-id: target })
)

;; Retrieve badge definition details
(define-read-only (query-badge-specifications (badge-id uint))
  (map-get? badge-specifications { badge-identifier: badge-id })
)
