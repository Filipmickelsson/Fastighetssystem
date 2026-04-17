import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";

export default function App() {
  const [properties, setProperties] = useState([]);
  const [units, setUnits] = useState([]);
  const [leases, setLeases] = useState([]);

  const [selectedPropertyId, setSelectedPropertyId] = useState(null);
  const [propertyTab, setPropertyTab] = useState("overview"); // overview | units | tenants
  const [modalType, setModalType] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const emptyPropertyForm = {
    street: "",
    zip: "",
    city: "",
  };

  const emptyUnitForm = {
    propertyId: "",
    name: "",
    type: "Lägenhet",
    size: "",
    rooms: "",
    rent: "",
  };

  const emptyLeaseForm = {
    tenantName: "",
    unitId: "",
    startDate: "",
    noticePeriod: "3 månader",
    status: "Aktivt",
  };

  const [propertyForm, setPropertyForm] = useState(emptyPropertyForm);
  const [unitForm, setUnitForm] = useState(emptyUnitForm);
  const [leaseForm, setLeaseForm] = useState(emptyLeaseForm);

  useEffect(() => {
    async function loadData() {
      try {
        const [
          { data: propertiesData, error: propertiesError },
          { data: unitsData, error: unitsError },
          { data: leasesData, error: leasesError },
        ] = await Promise.all([
          supabase.from("properties").select("*"),
          supabase.from("units").select("*"),
          supabase.from("leases").select("*"),
        ]);

        if (propertiesError) throw propertiesError;
        if (unitsError) throw unitsError;
        if (leasesError) throw leasesError;

        setProperties(
          (propertiesData || []).map((p) => ({
            id: p.id,
            street: p.street,
            zip: p.zip,
            city: p.city,
          }))
        );

        setUnits(
          (unitsData || []).map((u) => ({
            id: u.id,
            propertyId: u.property_id,
            name: u.name,
            type: u.type,
            size: Number(u.size),
            rooms: u.rooms,
            rent: Number(u.rent),
          }))
        );

        setLeases(
          (leasesData || []).map((l) => ({
            id: l.id,
            tenantName: l.tenant_name,
            unitId: l.unit_id,
            startDate: l.start_date,
            monthlyRent: Number(l.monthly_rent),
            noticePeriod: l.notice_period,
            status: l.status,
          }))
        );
      } catch (error) {
        console.error("Kunde inte läsa från databasen:", error);
        alert("Kunde inte läsa data från databasen.");
      } finally {
        setIsLoaded(true);
      }
    }

    loadData();
  }, []);

  useEffect(() => {
    if (!isLoaded) return;

    if (
      selectedPropertyId &&
      !properties.some((property) => property.id === selectedPropertyId)
    ) {
      setSelectedPropertyId(null);
      setPropertyTab("overview");
    }
  }, [properties, selectedPropertyId, isLoaded]);

  function formatCurrency(value) {
    return new Intl.NumberFormat("sv-SE").format(Number(value || 0));
  }

  function getPropertyById(propertyId) {
    return properties.find((p) => p.id === propertyId);
  }

  function getUnitById(unitId) {
    return units.find((u) => u.id === unitId);
  }

  function getPropertyFullAddress(propertyId) {
    const p = getPropertyById(propertyId);
    if (!p) return "Okänd fastighet";
    return `${p.street}, ${p.zip} ${p.city}`;
  }

  function getUnitName(unitId) {
    const unit = getUnitById(unitId);
    return unit ? unit.name : "Okänd enhet";
  }

  function getUnitsForProperty(propertyId) {
    return units.filter((u) => u.propertyId === propertyId);
  }

  function getLeasesForProperty(propertyId) {
    const propertyUnitIds = getUnitsForProperty(propertyId).map((u) => u.id);
    return leases.filter((l) => propertyUnitIds.includes(l.unitId));
  }

  function formatRent(unitId, rent) {
    const unit = getUnitById(unitId);
    const formatted = `${formatCurrency(rent)} kr`;
    if (!unit) return formatted;
    return unit.type === "Lokal" ? `${formatted} exkl moms` : formatted;
  }

  function hasActiveLease(unitId, ignoreLeaseId = null) {
    return leases.some(
      (lease) =>
        lease.unitId === unitId &&
        lease.status === "Aktivt" &&
        lease.id !== ignoreLeaseId
    );
  }

  function openCreateModal(type) {
    setEditingItem(null);
    setModalType(type);

    if (type === "property") {
      setPropertyForm(emptyPropertyForm);
    }

    if (type === "unit") {
      setUnitForm({
        ...emptyUnitForm,
        propertyId: selectedPropertyId || properties[0]?.id || "",
      });
    }

    if (type === "lease") {
      setLeaseForm(emptyLeaseForm);
    }
  }

  function openEditModal(type, item) {
    setEditingItem(item);
    setModalType(type);

    if (type === "property") {
      setPropertyForm({
        street: item.street,
        zip: item.zip,
        city: item.city,
      });
    }

    if (type === "unit") {
      setUnitForm({
        propertyId: item.propertyId,
        name: item.name,
        type: item.type,
        size: String(item.size),
        rooms: item.rooms ?? "",
        rent: String(item.rent),
      });
    }

    if (type === "lease") {
      setLeaseForm({
        tenantName: item.tenantName,
        unitId: item.unitId,
        startDate: item.startDate,
        noticePeriod: item.noticePeriod,
        status: item.status,
      });
    }
  }

  function closeModal() {
    setModalType(null);
    setEditingItem(null);
  }

  async function saveProperty() {
    if (
      !propertyForm.street.trim() ||
      !propertyForm.zip.trim() ||
      !propertyForm.city.trim()
    ) {
      return;
    }

    const payload = {
      street: propertyForm.street.trim(),
      zip: propertyForm.zip.trim(),
      city: propertyForm.city.trim(),
    };

    try {
      if (editingItem) {
        const { data, error } = await supabase
          .from("properties")
          .update(payload)
          .eq("id", editingItem.id)
          .select()
          .single();

        if (error) throw error;

        setProperties((prev) =>
          prev.map((property) =>
            property.id === editingItem.id
              ? {
                  id: data.id,
                  street: data.street,
                  zip: data.zip,
                  city: data.city,
                }
              : property
          )
        );
      } else {
        const { data, error } = await supabase
          .from("properties")
          .insert(payload)
          .select()
          .single();

        if (error) throw error;

        setProperties((prev) => [
          ...prev,
          {
            id: data.id,
            street: data.street,
            zip: data.zip,
            city: data.city,
          },
        ]);
      }

      closeModal();
    } catch (error) {
      console.error("Kunde inte spara fastighet:", error);
      alert("Det gick inte att spara fastigheten.");
    }
  }

  async function saveUnit() {
    if (
      !unitForm.propertyId ||
      !unitForm.name.trim() ||
      !unitForm.size ||
      !unitForm.rent
    ) {
      return;
    }

    const parsedSize = Number(unitForm.size);
    const parsedRooms =
      unitForm.type === "Lägenhet" ? Number(unitForm.rooms || 0) : null;
    const parsedRent = Number(unitForm.rent);

    if (Number.isNaN(parsedSize) || Number.isNaN(parsedRent)) return;
    if (unitForm.type === "Lägenhet" && Number.isNaN(parsedRooms)) return;

    const payload = {
      property_id: unitForm.propertyId,
      name: unitForm.name.trim(),
      type: unitForm.type,
      size: parsedSize,
      rooms: parsedRooms,
      rent: parsedRent,
    };

    try {
      if (editingItem) {
        const { data, error } = await supabase
          .from("units")
          .update(payload)
          .eq("id", editingItem.id)
          .select()
          .single();

        if (error) throw error;

        setUnits((prev) =>
          prev.map((unit) =>
            unit.id === editingItem.id
              ? {
                  id: data.id,
                  propertyId: data.property_id,
                  name: data.name,
                  type: data.type,
                  size: Number(data.size),
                  rooms: data.rooms,
                  rent: Number(data.rent),
                }
              : unit
          )
        );

        const { error: leaseUpdateError } = await supabase
          .from("leases")
          .update({ monthly_rent: parsedRent })
          .eq("unit_id", editingItem.id);

        if (leaseUpdateError) throw leaseUpdateError;

        setLeases((prev) =>
          prev.map((lease) =>
            lease.unitId === editingItem.id
              ? { ...lease, monthlyRent: parsedRent }
              : lease
          )
        );
      } else {
        const { data, error } = await supabase
          .from("units")
          .insert(payload)
          .select()
          .single();

        if (error) throw error;

        setUnits((prev) => [
          ...prev,
          {
            id: data.id,
            propertyId: data.property_id,
            name: data.name,
            type: data.type,
            size: Number(data.size),
            rooms: data.rooms,
            rent: Number(data.rent),
          },
        ]);
      }

      closeModal();
    } catch (error) {
      console.error("Kunde inte spara enhet:", error);
      alert("Det gick inte att spara enheten.");
    }
  }

  async function saveLease() {
    if (
      !leaseForm.tenantName.trim() ||
      !leaseForm.unitId ||
      !leaseForm.startDate ||
      !leaseForm.noticePeriod ||
      !leaseForm.status
    ) {
      return;
    }

    const selectedUnit = getUnitById(leaseForm.unitId);
    if (!selectedUnit) return;

    if (
      leaseForm.status === "Aktivt" &&
      hasActiveLease(leaseForm.unitId, editingItem?.id || null)
    ) {
      alert("Den här enheten har redan en aktiv hyresgäst.");
      return;
    }

    const payload = {
      tenant_name: leaseForm.tenantName.trim(),
      unit_id: leaseForm.unitId,
      start_date: leaseForm.startDate,
      monthly_rent: selectedUnit.rent,
      notice_period: leaseForm.noticePeriod,
      status: leaseForm.status,
    };

    try {
      if (editingItem) {
        const { data, error } = await supabase
          .from("leases")
          .update(payload)
          .eq("id", editingItem.id)
          .select()
          .single();

        if (error) throw error;

        setLeases((prev) =>
          prev.map((lease) =>
            lease.id === editingItem.id
              ? {
                  id: data.id,
                  tenantName: data.tenant_name,
                  unitId: data.unit_id,
                  startDate: data.start_date,
                  monthlyRent: Number(data.monthly_rent),
                  noticePeriod: data.notice_period,
                  status: data.status,
                }
              : lease
          )
        );
      } else {
        const { data, error } = await supabase
          .from("leases")
          .insert(payload)
          .select()
          .single();

        if (error) throw error;

        setLeases((prev) => [
          ...prev,
          {
            id: data.id,
            tenantName: data.tenant_name,
            unitId: data.unit_id,
            startDate: data.start_date,
            monthlyRent: Number(data.monthly_rent),
            noticePeriod: data.notice_period,
            status: data.status,
          },
        ]);
      }

      closeModal();
    } catch (error) {
      console.error("Kunde inte spara hyresgäst:", error);
      alert("Det gick inte att spara hyresgästen.");
    }
  }

  async function deleteProperty(propertyId) {
    try {
      const propertyUnits = units.filter((u) => u.propertyId === propertyId);
      const propertyUnitIds = propertyUnits.map((u) => u.id);

      const { error } = await supabase
        .from("properties")
        .delete()
        .eq("id", propertyId);

      if (error) throw error;

      setProperties((prev) => prev.filter((p) => p.id !== propertyId));
      setUnits((prev) => prev.filter((u) => u.propertyId !== propertyId));
      setLeases((prev) => prev.filter((l) => !propertyUnitIds.includes(l.unitId)));

      if (selectedPropertyId === propertyId) {
        setSelectedPropertyId(null);
        setPropertyTab("overview");
      }
    } catch (error) {
      console.error("Kunde inte ta bort fastighet:", error);
      alert("Det gick inte att ta bort fastigheten.");
    }
  }

  async function deleteUnit(unitId) {
    try {
      const { error } = await supabase.from("units").delete().eq("id", unitId);

      if (error) throw error;

      setUnits((prev) => prev.filter((u) => u.id !== unitId));
      setLeases((prev) => prev.filter((l) => l.unitId !== unitId));
    } catch (error) {
      console.error("Kunde inte ta bort enhet:", error);
      alert("Det gick inte att ta bort enheten.");
    }
  }

  async function deleteLease(leaseId) {
    try {
      const { error } = await supabase
        .from("leases")
        .delete()
        .eq("id", leaseId);

      if (error) throw error;

      setLeases((prev) => prev.filter((l) => l.id !== leaseId));
    } catch (error) {
      console.error("Kunde inte ta bort hyresgäst:", error);
      alert("Det gick inte att ta bort hyresgästen.");
    }
  }

  async function clearAllData() {
    const confirmed = window.confirm(
      "Vill du verkligen radera all sparad data?"
    );
    if (!confirmed) return;

    try {
      const { error: leasesError } = await supabase.from("leases").delete().neq("id", "");
      if (leasesError) throw leasesError;

      const { error: unitsError } = await supabase.from("units").delete().neq("id", "");
      if (unitsError) throw unitsError;

      const { error: propertiesError } = await supabase
        .from("properties")
        .delete()
        .neq("id", "");
      if (propertiesError) throw propertiesError;

      setProperties([]);
      setUnits([]);
      setLeases([]);
      setSelectedPropertyId(null);
      setPropertyTab("overview");
    } catch (error) {
      console.error("Kunde inte rensa data:", error);
      alert("Det gick inte att rensa all data.");
    }
  }

  const selectedProperty = useMemo(
    () => properties.find((p) => p.id === selectedPropertyId) || null,
    [properties, selectedPropertyId]
  );

  const selectedPropertyUnits = useMemo(() => {
    if (!selectedPropertyId) return [];
    return units.filter((u) => u.propertyId === selectedPropertyId);
  }, [units, selectedPropertyId]);

  const selectedPropertyLeases = useMemo(() => {
    if (!selectedPropertyId) return [];
    const unitIds = selectedPropertyUnits.map((u) => u.id);
    return leases.filter((l) => unitIds.includes(l.unitId));
  }, [leases, selectedPropertyUnits, selectedPropertyId]);

  const activeTenantCount = useMemo(
    () => selectedPropertyLeases.filter((l) => l.status === "Aktivt").length,
    [selectedPropertyLeases]
  );

  const availableUnitsForLease = useMemo(() => {
    const relevantUnits = selectedPropertyId
      ? units.filter((u) => u.propertyId === selectedPropertyId)
      : units;

    if (editingItem && modalType === "lease") {
      return relevantUnits.filter(
        (unit) =>
          !hasActiveLease(unit.id, editingItem.id) ||
          unit.id === editingItem.unitId
      );
    }

    return relevantUnits.filter((unit) => !hasActiveLease(unit.id));
  }, [units, selectedPropertyId, editingItem, modalType, leases]);

  const styles = {
    page: {
      minHeight: "100vh",
      background: "#f3f6fb",
      padding: "32px 20px",
      color: "#1f2937",
      fontFamily:
        "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
    },
    container: {
      maxWidth: "1100px",
      margin: "0 auto",
    },
    hero: {
      background: "linear-gradient(135deg, #1e293b, #334155)",
      color: "white",
      borderRadius: "20px",
      padding: "20px 24px",
      marginBottom: "20px",
      boxShadow: "0 12px 30px rgba(15, 23, 42, 0.18)",
    },
    heroTitle: {
      margin: 0,
      fontSize: "28px",
      fontWeight: 700,
    },
    topBar: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: "12px",
      marginBottom: "18px",
      flexWrap: "wrap",
    },
    topBarActions: {
      display: "flex",
      gap: "8px",
      flexWrap: "wrap",
    },
    title: {
      margin: 0,
      fontSize: "22px",
      fontWeight: 700,
    },
    primaryButton: {
      padding: "10px 14px",
      borderRadius: "12px",
      border: "none",
      background: "#2563eb",
      color: "white",
      fontWeight: 600,
      fontSize: "14px",
      cursor: "pointer",
    },
    secondaryButton: {
      padding: "9px 12px",
      borderRadius: "10px",
      border: "1px solid #cbd5e1",
      background: "white",
      cursor: "pointer",
      fontWeight: 600,
      fontSize: "14px",
    },
    dangerButton: {
      padding: "9px 12px",
      borderRadius: "10px",
      border: "1px solid #fecaca",
      background: "#fff1f2",
      color: "#b91c1c",
      cursor: "pointer",
      fontWeight: 600,
      fontSize: "14px",
    },
    propertyGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
      gap: "14px",
    },
    propertyCard: {
      background: "white",
      borderRadius: "16px",
      padding: "16px",
      border: "1px solid #e5e7eb",
      boxShadow: "0 6px 18px rgba(15, 23, 42, 0.06)",
      cursor: "pointer",
    },
    propertyTitle: {
      margin: 0,
      fontSize: "16px",
      fontWeight: 700,
      color: "#111827",
    },
    muted: {
      color: "#6b7280",
      fontSize: "13px",
    },
    cardActions: {
      display: "flex",
      gap: "8px",
      marginTop: "12px",
      flexWrap: "wrap",
    },
    compactHeader: {
      background: "white",
      borderRadius: "16px",
      padding: "16px 18px",
      border: "1px solid #e5e7eb",
      boxShadow: "0 6px 18px rgba(15, 23, 42, 0.06)",
      marginBottom: "18px",
    },
    compactHeaderTop: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: "12px",
      flexWrap: "wrap",
      marginBottom: "14px",
    },
    compactTitle: {
      margin: 0,
      fontSize: "18px",
      fontWeight: 700,
      color: "#111827",
    },
    compactNav: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
      gap: "12px",
    },
    compactNavCard: (active) => ({
      border: active ? "1px solid #60a5fa" : "1px solid #e5e7eb",
      background: active ? "#dbeafe" : "#f8fafc",
      borderRadius: "14px",
      padding: "14px",
      cursor: "pointer",
    }),
    compactNavLabel: {
      margin: 0,
      fontSize: "13px",
      color: "#6b7280",
    },
    compactNavValue: {
      margin: "6px 0 0 0",
      fontSize: "24px",
      fontWeight: 700,
      color: "#111827",
    },
    sectionCard: {
      background: "white",
      borderRadius: "18px",
      padding: "22px",
      boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)",
      border: "1px solid #e5e7eb",
    },
    sectionHeader: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: "12px",
      marginBottom: "18px",
      flexWrap: "wrap",
    },
    sectionTitle: {
      margin: 0,
      fontSize: "20px",
      fontWeight: 700,
      color: "#111827",
    },
    list: {
      listStyle: "none",
      padding: 0,
      margin: 0,
      display: "flex",
      flexDirection: "column",
      gap: "12px",
    },
    listItem: {
      border: "1px solid #e5e7eb",
      borderRadius: "14px",
      padding: "14px",
      background: "#f9fafb",
      lineHeight: 1.6,
      fontSize: "14px",
      display: "flex",
      justifyContent: "space-between",
      gap: "16px",
      alignItems: "flex-start",
      flexWrap: "wrap",
    },
    empty: {
      margin: 0,
      color: "#6b7280",
      fontSize: "14px",
    },
    modalOverlay: {
      position: "fixed",
      inset: 0,
      background: "rgba(15, 23, 42, 0.45)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px",
      zIndex: 50,
    },
    modal: {
      background: "white",
      borderRadius: "20px",
      padding: "24px",
      width: "100%",
      maxWidth: "760px",
      boxShadow: "0 20px 50px rgba(15, 23, 42, 0.2)",
      maxHeight: "90vh",
      overflowY: "auto",
    },
    formGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
      gap: "14px",
      alignItems: "end",
    },
    field: {
      display: "flex",
      flexDirection: "column",
      gap: "6px",
    },
    label: {
      fontSize: "13px",
      fontWeight: 600,
      color: "#374151",
    },
    input: {
      padding: "12px 14px",
      borderRadius: "12px",
      border: "1px solid #d1d5db",
      background: "white",
      fontSize: "14px",
      outline: "none",
      boxSizing: "border-box",
      width: "100%",
    },
    inputDisabled: {
      padding: "12px 14px",
      borderRadius: "12px",
      border: "1px solid #d1d5db",
      background: "#f9fafb",
      color: "#6b7280",
      fontSize: "14px",
      outline: "none",
      boxSizing: "border-box",
      width: "100%",
    },
    modalActions: {
      display: "flex",
      justifyContent: "flex-end",
      gap: "10px",
      marginTop: "18px",
    },
    cancelButton: {
      padding: "12px 16px",
      borderRadius: "12px",
      border: "1px solid #d1d5db",
      background: "white",
      cursor: "pointer",
      fontWeight: 600,
    },
    saveButton: {
      padding: "12px 16px",
      borderRadius: "12px",
      border: "none",
      background: "#2563eb",
      color: "white",
      cursor: "pointer",
      fontWeight: 600,
    },
  };

  function renderPropertyList() {
    return (
      <>
        <div style={styles.topBar}>
          <h2 style={styles.title}>Fastigheter</h2>

          <div style={styles.topBarActions}>
            <button
              style={styles.primaryButton}
              onClick={() => openCreateModal("property")}
            >
              Lägg till fastighet
            </button>
            <button style={styles.dangerButton} onClick={clearAllData}>
              Rensa allt
            </button>
          </div>
        </div>

        {properties.length === 0 ? (
          <div style={styles.sectionCard}>
            <p style={styles.empty}>Inga fastigheter än.</p>
          </div>
        ) : (
          <div style={styles.propertyGrid}>
            {properties.map((property) => {
              const propertyUnits = getUnitsForProperty(property.id);
              const propertyLeases = getLeasesForProperty(property.id);
              const activeCount = propertyLeases.filter(
                (lease) => lease.status === "Aktivt"
              ).length;

              return (
                <div
                  key={property.id}
                  style={styles.propertyCard}
                  onClick={() => {
                    setSelectedPropertyId(property.id);
                    setPropertyTab("overview");
                  }}
                >
                  <p style={styles.propertyTitle}>{property.street}</p>
                  <p style={styles.muted}>
                    {property.zip} {property.city}
                  </p>
                  <p style={styles.muted}>
                    Enheter: {propertyUnits.length} · Hyresgäster: {activeCount}
                  </p>

                  <div style={styles.cardActions}>
                    <button
                      style={styles.secondaryButton}
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditModal("property", property);
                      }}
                    >
                      Redigera
                    </button>
                    <button
                      style={styles.dangerButton}
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteProperty(property.id);
                      }}
                    >
                      Ta bort
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </>
    );
  }

  function renderPropertyDetail() {
    if (!selectedProperty) return null;

    return (
      <>
        <div style={styles.compactHeader}>
          <div style={styles.compactHeaderTop}>
            <div>
              <h2 style={styles.compactTitle}>{selectedProperty.street}</h2>
              <div style={styles.muted}>
                {selectedProperty.zip} {selectedProperty.city}
              </div>
            </div>

            <button
              style={styles.secondaryButton}
              onClick={() => {
                setSelectedPropertyId(null);
                setPropertyTab("overview");
              }}
            >
              Tillbaka
            </button>
          </div>

          <div style={styles.compactNav}>
            <div
              style={styles.compactNavCard(propertyTab === "units")}
              onClick={() => setPropertyTab("units")}
            >
              <p style={styles.compactNavLabel}>Enheter</p>
              <p style={styles.compactNavValue}>{selectedPropertyUnits.length}</p>
            </div>

            <div
              style={styles.compactNavCard(propertyTab === "tenants")}
              onClick={() => setPropertyTab("tenants")}
            >
              <p style={styles.compactNavLabel}>Hyresgäster</p>
              <p style={styles.compactNavValue}>{activeTenantCount}</p>
            </div>
          </div>
        </div>

        {propertyTab === "overview" && (
          <div style={styles.sectionCard}>
            <h3 style={styles.sectionTitle}>Välj en del</h3>
            <p style={styles.empty}>
              Klicka på Enheter eller Hyresgäster ovan för att fortsätta.
            </p>
          </div>
        )}

        {propertyTab === "units" && (
          <div style={styles.sectionCard}>
            <div style={styles.sectionHeader}>
              <h3 style={styles.sectionTitle}>Enheter</h3>
              <button
                style={styles.primaryButton}
                onClick={() => openCreateModal("unit")}
              >
                Lägg till enhet
              </button>
            </div>

            {selectedPropertyUnits.length === 0 ? (
              <p style={styles.empty}>Inga enheter för denna fastighet.</p>
            ) : (
              <ul style={styles.list}>
                {selectedPropertyUnits.map((unit) => (
                  <li key={unit.id} style={styles.listItem}>
                    <div>
                      <strong>{unit.name}</strong>
                      <br />
                      {unit.type} · {unit.size} kvm
                      {unit.type === "Lägenhet" ? ` · ${unit.rooms} rum` : ""}
                      <br />
                      {formatRent(unit.id, unit.rent)}
                    </div>

                    <div style={styles.cardActions}>
                      <button
                        style={styles.secondaryButton}
                        onClick={() => openEditModal("unit", unit)}
                      >
                        Redigera
                      </button>
                      <button
                        style={styles.dangerButton}
                        onClick={() => deleteUnit(unit.id)}
                      >
                        Ta bort
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {propertyTab === "tenants" && (
          <div style={styles.sectionCard}>
            <div style={styles.sectionHeader}>
              <h3 style={styles.sectionTitle}>Hyresgäster</h3>
              <button
                style={styles.primaryButton}
                onClick={() => openCreateModal("lease")}
                disabled={selectedPropertyUnits.length === 0}
              >
                Lägg till hyresgäst
              </button>
            </div>

            {selectedPropertyLeases.length === 0 ? (
              <p style={styles.empty}>Inga hyresgäster för denna fastighet.</p>
            ) : (
              <ul style={styles.list}>
                {selectedPropertyLeases.map((lease) => (
                  <li key={lease.id} style={styles.listItem}>
                    <div>
                      <strong>{lease.tenantName}</strong>
                      <br />
                      Enhet: {getUnitName(lease.unitId)}
                      <br />
                      Startdatum: {lease.startDate}
                      <br />
                      Hyra: {formatRent(lease.unitId, lease.monthlyRent)}
                      <br />
                      Uppsägningstid: {lease.noticePeriod}
                      <br />
                      <span style={styles.muted}>Status: {lease.status}</span>
                    </div>

                    <div style={styles.cardActions}>
                      <button
                        style={styles.secondaryButton}
                        onClick={() => openEditModal("lease", lease)}
                      >
                        Redigera
                      </button>
                      <button
                        style={styles.dangerButton}
                        onClick={() => deleteLease(lease.id)}
                      >
                        Ta bort
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </>
    );
  }

  function renderModal() {
    if (!modalType) return null;

    return (
      <div style={styles.modalOverlay} onClick={closeModal}>
        <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
          {modalType === "property" && (
            <>
              <h2 style={styles.sectionTitle}>
                {editingItem ? "Redigera fastighet" : "Lägg till fastighet"}
              </h2>

              <div style={styles.formGrid}>
                <div style={styles.field}>
                  <label style={styles.label}>Gatuadress</label>
                  <input
                    style={styles.input}
                    value={propertyForm.street}
                    onChange={(e) =>
                      setPropertyForm((prev) => ({ ...prev, street: e.target.value }))
                    }
                  />
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>Postnummer</label>
                  <input
                    style={styles.input}
                    value={propertyForm.zip}
                    onChange={(e) =>
                      setPropertyForm((prev) => ({ ...prev, zip: e.target.value }))
                    }
                  />
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>Postort</label>
                  <input
                    style={styles.input}
                    value={propertyForm.city}
                    onChange={(e) =>
                      setPropertyForm((prev) => ({ ...prev, city: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div style={styles.modalActions}>
                <button style={styles.cancelButton} onClick={closeModal}>
                  Avbryt
                </button>
                <button style={styles.saveButton} onClick={saveProperty}>
                  Spara
                </button>
              </div>
            </>
          )}

          {modalType === "unit" && (
            <>
              <h2 style={styles.sectionTitle}>
                {editingItem ? "Redigera enhet" : "Lägg till enhet"}
              </h2>

              <div style={styles.formGrid}>
                <div style={styles.field}>
                  <label style={styles.label}>Fastighet</label>
                  <select
                    style={styles.input}
                    value={unitForm.propertyId}
                    onChange={(e) =>
                      setUnitForm((prev) => ({ ...prev, propertyId: e.target.value }))
                    }
                  >
                    <option value="">Välj fastighet</option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.street}, {p.city}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>Enhet</label>
                  <input
                    style={styles.input}
                    value={unitForm.name}
                    onChange={(e) =>
                      setUnitForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                  />
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>Typ</label>
                  <select
                    style={styles.input}
                    value={unitForm.type}
                    onChange={(e) =>
                      setUnitForm((prev) => ({
                        ...prev,
                        type: e.target.value,
                        rooms: e.target.value === "Lokal" ? "" : prev.rooms,
                      }))
                    }
                  >
                    <option value="Lägenhet">Lägenhet</option>
                    <option value="Lokal">Lokal</option>
                  </select>
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>Storlek (kvm)</label>
                  <input
                    style={styles.input}
                    type="number"
                    value={unitForm.size}
                    onChange={(e) =>
                      setUnitForm((prev) => ({ ...prev, size: e.target.value }))
                    }
                  />
                </div>

                {unitForm.type === "Lägenhet" && (
                  <div style={styles.field}>
                    <label style={styles.label}>Antal rum</label>
                    <input
                      style={styles.input}
                      type="number"
                      value={unitForm.rooms}
                      onChange={(e) =>
                        setUnitForm((prev) => ({ ...prev, rooms: e.target.value }))
                      }
                    />
                  </div>
                )}

                <div style={styles.field}>
                  <label style={styles.label}>
                    Hyra {unitForm.type === "Lokal" ? "(exkl moms)" : ""}
                  </label>
                  <input
                    style={styles.input}
                    type="number"
                    value={unitForm.rent}
                    onChange={(e) =>
                      setUnitForm((prev) => ({ ...prev, rent: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div style={styles.modalActions}>
                <button style={styles.cancelButton} onClick={closeModal}>
                  Avbryt
                </button>
                <button style={styles.saveButton} onClick={saveUnit}>
                  Spara
                </button>
              </div>
            </>
          )}

          {modalType === "lease" && (
            <>
              <h2 style={styles.sectionTitle}>
                {editingItem ? "Redigera hyresgäst" : "Lägg till hyresgäst"}
              </h2>

              <div style={styles.formGrid}>
                <div style={styles.field}>
                  <label style={styles.label}>Hyresgästens namn</label>
                  <input
                    style={styles.input}
                    value={leaseForm.tenantName}
                    onChange={(e) =>
                      setLeaseForm((prev) => ({
                        ...prev,
                        tenantName: e.target.value,
                      }))
                    }
                  />
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>Enhet</label>
                  <select
                    style={styles.input}
                    value={leaseForm.unitId}
                    onChange={(e) =>
                      setLeaseForm((prev) => ({ ...prev, unitId: e.target.value }))
                    }
                  >
                    <option value="">Välj enhet</option>
                    {availableUnitsForLease.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.name} ({unit.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>Startdatum</label>
                  <input
                    style={styles.input}
                    type="date"
                    value={leaseForm.startDate}
                    onChange={(e) =>
                      setLeaseForm((prev) => ({
                        ...prev,
                        startDate: e.target.value,
                      }))
                    }
                  />
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>Hyra</label>
                  <input
                    style={styles.inputDisabled}
                    value={
                      leaseForm.unitId
                        ? formatRent(
                            leaseForm.unitId,
                            getUnitById(leaseForm.unitId)?.rent || 0
                          )
                        : ""
                    }
                    disabled
                    readOnly
                  />
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>Uppsägningstid</label>
                  <select
                    style={styles.input}
                    value={leaseForm.noticePeriod}
                    onChange={(e) =>
                      setLeaseForm((prev) => ({
                        ...prev,
                        noticePeriod: e.target.value,
                      }))
                    }
                  >
                    <option value="1 månad">1 månad</option>
                    <option value="3 månader">3 månader</option>
                    <option value="6 månader">6 månader</option>
                    <option value="9 månader">9 månader</option>
                    <option value="12 månader">12 månader</option>
                  </select>
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>Status</label>
                  <select
                    style={styles.input}
                    value={leaseForm.status}
                    onChange={(e) =>
                      setLeaseForm((prev) => ({ ...prev, status: e.target.value }))
                    }
                  >
                    <option value="Aktivt">Aktivt</option>
                    <option value="Uppsagt">Uppsagt</option>
                    <option value="Avslutat">Avslutat</option>
                  </select>
                </div>
              </div>

              <div style={styles.modalActions}>
                <button style={styles.cancelButton} onClick={closeModal}>
                  Avbryt
                </button>
                <button style={styles.saveButton} onClick={saveLease}>
                  Spara
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.hero}>
          <h1 style={styles.heroTitle}>Fastighetssystem</h1>
        </div>

        {!selectedPropertyId ? renderPropertyList() : renderPropertyDetail()}

        {renderModal()}
      </div>
    </div>
  );
}