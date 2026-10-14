import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Drawer, Form, Input, Steps } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { Incident, IncidentReq } from "#/ims";
import incidentService from "@/api/services/incidentService";
import { Icon } from "@/components/icon";
import { useUserInfo } from "@/store/userStore";
import { Button } from "@/ui/button";
import { reverseGeocode } from "@/utils/geocode";
import AddressSearch from "./address-search";
import LocationPicker from "./location-picker";
import NearbyVehicles from "./nearby-vehicles";
import TenantSelect from "./tenant-select";

interface Props {
	open: boolean;
	onClose: () => void;
	/** Có = sửa sự vụ; không = tạo mới. */
	incident?: Incident | null;
	/** Điểm chọn sẵn (vd bấm trên bản đồ giám sát). */
	initialPoint?: { lat: number; lng: number } | null;
	onSaved?: (incident: Incident) => void;
}

type FormValues = IncidentReq;

const PHONE_RE = /^0\d{9}$/;

export default function IncidentFormDrawer({ open, onClose, incident, initialPoint, onSaved }: Props) {
	const { t, i18n } = useTranslation();
	const qc = useQueryClient();
	const { tenant_id } = useUserInfo();
	const [form] = Form.useForm<FormValues>();
	const [step, setStep] = useState(0);
	const [deviceIds, setDeviceIds] = useState<number[]>([]);
	const lat = Form.useWatch("lat", form);
	const lng = Form.useWatch("lng", form);
	const formTenantId = Form.useWatch("tenant_id", form);
	const isEdit = !!incident;

	// biome-ignore lint/correctness/useExhaustiveDependencies: chỉ khởi tạo lại form khi mở drawer
	useEffect(() => {
		if (!open) return;
		setStep(0);
		setDeviceIds([]);
		form.resetFields();
		if (incident) {
			form.setFieldsValue({ ...incident });
		} else {
			form.setFieldsValue({ tenant_id, lat: initialPoint?.lat, lng: initialPoint?.lng });
			if (initialPoint) fillAddress(initialPoint.lat, initialPoint.lng);
		}
	}, [open, incident, initialPoint]);

	const fillAddress = async (la: number, ln: number) => {
		const addr = await reverseGeocode(la, ln, i18n.language === "en_US" ? "en" : "vi");
		if (addr) form.setFieldsValue({ location_address: addr, location: addr.split(",").slice(0, 2).join(",") });
	};

	const pick = (la: number, ln: number) => {
		form.setFieldsValue({ lat: Number(la.toFixed(7)), lng: Number(ln.toFixed(7)) });
		fillAddress(la, ln);
	};

	const save = useMutation({
		mutationFn: (values: FormValues) =>
			isEdit
				? incidentService.update(incident.id, values)
				: incidentService.create({ ...values, device_ids: deviceIds.length ? deviceIds : undefined }),
		onSuccess: (saved) => {
			toast.success(isEdit ? t("incident.updated") : t("incident.created"));
			qc.invalidateQueries({ queryKey: ["incident"] });
			qc.invalidateQueries({ queryKey: ["incident-detail"] });
			qc.invalidateQueries({ queryKey: ["incident-active"] });
			qc.invalidateQueries({ queryKey: ["device-all"] });
			onSaved?.(saved);
			onClose();
		},
	});

	const submit = async () => {
		const values = await form.validateFields();
		save.mutate({ ...form.getFieldsValue(true), ...values });
	};

	const next = async () => {
		await form.validateFields();
		setStep(1);
	};

	return (
		<Drawer
			open={open}
			onClose={onClose}
			width={560}
			destroyOnHidden
			title={
				<span className="flex items-center gap-2">
					<Icon
						icon={isEdit ? "solar:pen-new-square-bold-duotone" : "solar:siren-rounded-bold-duotone"}
						size={22}
						className="text-error"
					/>
					{isEdit ? t("incident.edit") : t("incident.create")}
				</span>
			}
			footer={
				<div className="flex justify-between gap-2">
					<Button variant="outline" onClick={step === 1 ? () => setStep(0) : onClose}>
						{step === 1 ? t("common.back") : t("common.cancelText")}
					</Button>
					{!isEdit && step === 0 ? (
						<div className="flex gap-2">
							<Button variant="outline" onClick={submit} disabled={save.isPending}>
								{t("incident.form.createOnly")}
							</Button>
							<Button onClick={next}>
								{t("incident.form.nextDispatch")}
								<Icon icon="solar:arrow-right-linear" size={16} />
							</Button>
						</div>
					) : (
						<Button onClick={submit} disabled={save.isPending}>
							<Icon icon="solar:check-circle-bold" size={18} />
							{isEdit ? t("common.saveText") : t("incident.form.createAndDispatch", { count: deviceIds.length })}
						</Button>
					)}
				</div>
			}
		>
			{!isEdit && (
				<Steps
					size="small"
					current={step}
					className="mb-5"
					items={[{ title: t("incident.form.stepInfo") }, { title: t("incident.form.stepDispatch") }]}
				/>
			)}

			<Form form={form} layout="vertical" requiredMark="optional" className={step === 1 ? "hidden" : ""}>
				<Form.Item
					name="name"
					label={t("incident.field.name")}
					rules={[{ required: true, whitespace: true, message: t("validation.required") }]}
				>
					<Input placeholder={t("incident.form.namePlaceholder")} maxLength={255} />
				</Form.Item>

				<Form.Item label={t("incident.field.location")} required={false}>
					<div className="flex flex-col gap-2">
						<AddressSearch onSelect={(r) => pick(r.lat, r.lng)} />
						<LocationPicker lat={lat} lng={lng} onChange={pick} />
					</div>
				</Form.Item>
				<Form.Item name="location_address" label={t("incident.field.address")}>
					<Input.TextArea autoSize={{ minRows: 1, maxRows: 3 }} />
				</Form.Item>
				<Form.Item name="lat" hidden>
					<Input />
				</Form.Item>
				<Form.Item name="lng" hidden>
					<Input />
				</Form.Item>
				<Form.Item name="location" hidden>
					<Input />
				</Form.Item>

				{!isEdit && (
					<Form.Item name="tenant_id" label={t("incident.field.tenant")} tooltip={t("incident.form.tenantTip")}>
						<TenantSelect />
					</Form.Item>
				)}

				<Form.Item name="description" label={t("incident.field.description")}>
					<Input.TextArea autoSize={{ minRows: 2, maxRows: 6 }} />
				</Form.Item>

				<div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
					<Form.Item name="name_reporter" label={t("incident.field.reporter")}>
						<Input prefix={<Icon icon="solar:user-linear" size={16} />} />
					</Form.Item>
					<Form.Item
						name="phone_number_reporter"
						label={t("incident.field.phone")}
						rules={[{ pattern: PHONE_RE, message: t("validation.phone") }]}
					>
						<Input prefix={<Icon icon="solar:phone-linear" size={16} />} maxLength={10} />
					</Form.Item>
				</div>

				<Form.Item name="note" label={t("incident.field.note")}>
					<Input.TextArea autoSize={{ minRows: 1, maxRows: 4 }} />
				</Form.Item>
			</Form>

			{step === 1 && (
				<div className="flex flex-col gap-3">
					<p className="text-sm text-text-secondary">{t("dispatch.hint")}</p>
					<NearbyVehicles
						lat={lat}
						lng={lng}
						tenantId={formTenantId}
						value={deviceIds}
						onChange={setDeviceIds}
						maxHeight={520}
					/>
				</div>
			)}
		</Drawer>
	);
}
