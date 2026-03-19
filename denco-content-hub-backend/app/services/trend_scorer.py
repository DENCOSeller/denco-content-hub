"""Trend scoring algorithm for viral content detection.

Pure computation — no database or external dependencies.
All methods are stateless and safe for concurrent use.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class ScoringWeights:
    """Configurable weights for viral score calculation."""

    velocity: float = 0.35
    acceleration: float = 0.25
    engagement: float = 0.20
    recency: float = 0.10
    scale: float = 0.10

    def __post_init__(self) -> None:
        total = self.velocity + self.acceleration + self.engagement + self.recency + self.scale
        if not math.isclose(total, 1.0, abs_tol=1e-6):
            msg = f"Weights must sum to 1.0, got {total}"
            raise ValueError(msg)


@dataclass(frozen=True)
class StageThresholds:
    """Configurable thresholds for trend stage determination."""

    # Maximum age (hours) for a trend to be considered "rising"
    rising_max_age_hours: float = 48.0
    # Acceleration must be above this to be considered "rising"
    rising_min_acceleration: float = 0.0
    # Acceleration in this range around zero = "peaking"
    peaking_acceleration_tolerance: float = 0.5
    # Minimum velocity to qualify as "peaking" (not just stagnant)
    peaking_min_velocity: float = 10.0
    # Acceleration below this negative threshold = "declining"
    declining_acceleration_threshold: float = -0.5


@dataclass
class TrendScorer:
    """Algorithm for calculating viral score, velocity, acceleration, and trend stage.

    All normalization coefficients are configurable via constructor parameters.
    Division by zero and edge cases (first snapshot, zero views) are handled.
    """

    weights: ScoringWeights = field(default_factory=ScoringWeights)
    stage_thresholds: StageThresholds = field(default_factory=StageThresholds)

    # Normalization caps for sub-scores (0-100 mapping)
    velocity_cap: float = 10_000.0  # views/hour considered "maximum"
    acceleration_cap: float = 1_000.0  # acceleration considered "maximum"
    er_cap: float = 0.15  # 15% ER considered "maximum"
    recency_half_life_hours: float = 24.0  # half-life for recency decay
    scale_log_base: float = 10.0  # log base for view count scaling
    scale_max_views: float = 10_000_000.0  # views count for max scale score

    def calculate_velocity(
        self,
        views_current: int | float,
        views_previous: int | float,
        hours_elapsed: float,
    ) -> float:
        """Calculate views per hour (growth rate).

        Args:
            views_current: Current view count.
            views_previous: Previous view count.
            hours_elapsed: Hours between measurements.

        Returns:
            Views gained per hour. Returns 0.0 if hours_elapsed <= 0.
        """
        if hours_elapsed <= 0:
            return 0.0
        return max(0.0, (views_current - views_previous) / hours_elapsed)

    def calculate_acceleration(
        self,
        velocity_current: float,
        velocity_previous: float,
        hours_elapsed: float,
    ) -> float:
        """Calculate change in velocity per hour.

        Args:
            velocity_current: Current velocity (views/hour).
            velocity_previous: Previous velocity (views/hour).
            hours_elapsed: Hours between velocity measurements.

        Returns:
            Acceleration value. Positive = speeding up, negative = slowing down.
        """
        if hours_elapsed <= 0:
            return 0.0
        return (velocity_current - velocity_previous) / hours_elapsed

    def calculate_engagement_rate(
        self,
        likes: int,
        comments: int,
        shares: int,
        views: int,
    ) -> float:
        """Calculate engagement rate: (likes + comments + shares) / views.

        Args:
            likes: Like/reaction count.
            comments: Comment count.
            shares: Share/repost count.
            views: Total view count.

        Returns:
            Engagement rate as a float (e.g. 0.05 = 5%). Returns 0.0 if views <= 0.
        """
        if views <= 0:
            return 0.0
        return (likes + comments + shares) / views

    def calculate_viral_score(
        self,
        velocity: float,
        acceleration: float,
        er: float,
        age_hours: float,
        views: int | float,
    ) -> float:
        """Calculate composite viral score on a 0-100 scale.

        Factors and default weights:
        - velocity (0.35): growth speed, capped at velocity_cap
        - acceleration (0.25): growth acceleration, capped at acceleration_cap
        - engagement (0.20): engagement rate, capped at er_cap
        - recency (0.10): exponential decay based on age
        - scale (0.10): logarithmic scale of total views

        Args:
            velocity: Views per hour.
            acceleration: Change in velocity per hour.
            er: Engagement rate (0.0 - 1.0).
            age_hours: Hours since content was published.
            views: Total view count.

        Returns:
            Viral score between 0.0 and 100.0.
        """
        # Velocity sub-score (0-100): linear scale capped
        velocity_score = min(100.0, (max(0.0, velocity) / self.velocity_cap) * 100.0) if self.velocity_cap > 0 else 0.0

        # Acceleration sub-score (0-100): only positive acceleration contributes
        accel_score = min(100.0, (max(0.0, acceleration) / self.acceleration_cap) * 100.0) if self.acceleration_cap > 0 else 0.0

        # Engagement sub-score (0-100)
        er_score = min(100.0, (max(0.0, er) / self.er_cap) * 100.0) if self.er_cap > 0 else 0.0

        # Recency sub-score (0-100): exponential decay
        if age_hours < 0:
            age_hours = 0.0
        if self.recency_half_life_hours > 0:
            decay = math.exp(-0.693 * age_hours / self.recency_half_life_hours)  # ln(2) ≈ 0.693
        else:
            decay = 0.0
        recency_score = decay * 100.0

        # Scale sub-score (0-100): logarithmic
        if views > 0 and self.scale_max_views > 0:
            log_views = math.log(views + 1, self.scale_log_base)
            log_max = math.log(self.scale_max_views + 1, self.scale_log_base)
            scale_score = min(100.0, (log_views / log_max) * 100.0) if log_max > 0 else 0.0
        else:
            scale_score = 0.0

        composite = (
            self.weights.velocity * velocity_score
            + self.weights.acceleration * accel_score
            + self.weights.engagement * er_score
            + self.weights.recency * recency_score
            + self.weights.scale * scale_score
        )

        return round(min(100.0, max(0.0, composite)), 2)

    def determine_stage(
        self,
        velocity: float,
        acceleration: float,
        age_hours: float,
    ) -> str:
        """Determine the current stage of a trend.

        Stages:
        - "rising": positive acceleration and age within threshold
        - "peaking": high velocity with acceleration near zero
        - "declining": significantly negative acceleration

        Args:
            velocity: Current velocity (views/hour).
            acceleration: Current acceleration.
            age_hours: Hours since publication.

        Returns:
            One of "rising", "peaking", "declining".
        """
        th = self.stage_thresholds

        # Check declining first (takes priority for old content with negative accel)
        if acceleration < th.declining_acceleration_threshold:
            return "declining"

        # Rising: positive acceleration and young content
        if acceleration > th.rising_min_acceleration and age_hours < th.rising_max_age_hours:
            return "rising"

        # Peaking: near-zero acceleration with meaningful velocity
        if abs(acceleration) <= th.peaking_acceleration_tolerance and velocity >= th.peaking_min_velocity:
            return "peaking"

        # Default: if old content with low velocity and no strong signal
        if age_hours >= th.rising_max_age_hours:
            return "declining"

        return "rising"

    def score_trend(
        self,
        current_metrics: dict[str, Any],
        previous_metrics: dict[str, Any] | None,
        hours_elapsed: float,
    ) -> dict[str, Any]:
        """Main scoring method. Computes all trend metrics from raw data.

        Args:
            current_metrics: Dict with keys: views, likes, comments, shares, age_hours.
                - views (int): current view count
                - likes (int): current like count
                - comments (int): current comment count
                - shares (int): current share count
                - age_hours (float): hours since publication
            previous_metrics: Dict with keys: views, velocity. None for first snapshot.
                - views (int): previous view count
                - velocity (float): previous velocity
            hours_elapsed: Hours since last measurement. Ignored if previous_metrics is None.

        Returns:
            Dict with keys: velocity, acceleration, er_score, viral_score, stage.
        """
        views = int(current_metrics.get("views", 0))
        likes = int(current_metrics.get("likes", 0))
        comments = int(current_metrics.get("comments", 0))
        shares = int(current_metrics.get("shares", 0))
        age_hours = float(current_metrics.get("age_hours", 0))

        # Calculate engagement rate
        er = self.calculate_engagement_rate(likes, comments, shares, views)

        if previous_metrics is not None and hours_elapsed > 0:
            prev_views = int(previous_metrics.get("views", 0))
            prev_velocity = float(previous_metrics.get("velocity", 0.0))

            velocity = self.calculate_velocity(views, prev_views, hours_elapsed)
            acceleration = self.calculate_acceleration(velocity, prev_velocity, hours_elapsed)
        else:
            # First snapshot: estimate velocity from total views / age
            if age_hours > 0:
                velocity = views / age_hours
            else:
                velocity = float(views)  # just published, velocity = total views
            acceleration = 0.0

        viral_score = self.calculate_viral_score(velocity, acceleration, er, age_hours, views)
        stage = self.determine_stage(velocity, acceleration, age_hours)

        return {
            "velocity": round(velocity, 4),
            "acceleration": round(acceleration, 4),
            "er_score": round(er, 6),
            "viral_score": viral_score,
            "stage": stage,
        }
