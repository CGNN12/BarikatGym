export function calculateMembershipStatus(
  membershipEndStr: string | null | undefined,
  currentStatus: string
) {
  if (!membershipEndStr) {
    return {
      status: currentStatus || "inactive",
      daysLeft: 0,
      isExpired: false,
      isExpiring: false,
    };
  }

  // Sadece gün/ay/yıl baz alınsın diye saatleri 00:00:00'a sabitliyoruz
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const endDate = new Date(membershipEndStr);
  endDate.setHours(0, 0, 0, 0);

  // Farkı gün cinsinden bul (1000ms * 60sn * 60dk * 24sa)
  const diffTime = endDate.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  let finalStatus = currentStatus || "inactive";
  let remainingDays = 0;
  let isExpired = false;

  if (diffDays === 0) {
    // Kural 1: Eğer Bitiş - Bugün == 0 ise, Kalan Gün = 1'dir ve Expired DEĞİLDİR
    remainingDays = 1;
    isExpired = false;
  } else if (diffDays < 0) {
    // Kural 2: Eğer Bitiş - Bugün < 0 ise, Kalan Gün = 0'dır ve Expired'dır
    remainingDays = 0;
    isExpired = true;
    if (finalStatus === "active") {
      finalStatus = "expired";
    }
  } else {
    // Kural 3: Eğer Bitiş - Bugün > 0 ise, Kalan Gün = Fark + 1'dir
    remainingDays = diffDays + 1;
    isExpired = false;
  }

  const isExpiring = !isExpired && remainingDays <= 7 && remainingDays > 0;

  return {
    status: finalStatus,
    daysLeft: remainingDays,
    isExpired,
    isExpiring,
  };
}
