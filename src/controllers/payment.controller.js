import axios from 'axios';
import { PAYPAL_API, PAYPAL_API_CLIENT, PAYPAL_API_SECRET, HOST } from '../config.js';

// Token de acceso a PayPal
const getAccessToken = async () => {
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');

    try {
        const { data } = await axios.post(`${PAYPAL_API}/v1/oauth2/token`, params, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json',
                'Accept-Language': 'en_US'
            },
            auth: {
                username: PAYPAL_API_CLIENT,
                password: PAYPAL_API_SECRET
            }
        });

        return data.access_token;
    } catch (error) {
        console.error('Error al obtener token:', {
            message: error.message,
            response: error.response?.data
        });
        throw new Error('Fallo al obtener token de PayPal');
    }
};

// Crear orden
export const createOrder = async (req, res) => {
    const { amount, currency_code, campaignId, donorId } = req.body;

    try {
        const access_token = await getAccessToken();

        const order = {
            intent: "CAPTURE",
            purchase_units: [{
                amount: {
                    currency_code,
                    value: amount.toString(),
                },
                custom_id: campaignId,
                reference_id: donorId,
                description: `Donación para campaña ${campaignId}`
            }],
            application_context: {
                brand_name: "ProHelp",
                landing_page: "NO_PREFERENCE",
                user_action: "PAY_NOW",
                return_url: `prohelp://paypal-return/success/success`,
                cancel_url: `prohelp://paypal-return/success/cancel`
            }
        };

        const response = await axios.post(`${PAYPAL_API}/v2/checkout/orders`, order, {
            headers: {
                Authorization: `Bearer ${access_token}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            }
        });

        if(response.data.status ==  'CREATED') {

            console.log("Datos para register",
                campaignId,
                donorId,
                req.body.email,
                req.body.phone,
                req.body.name,
                req.body.token,
                amount
            );
            
            RegisterDonation(
                campaignId,
                donorId,
                req.body.email,
                req.body.phone,
                req.body.name,
                req.body.token,
                amount
            );
        }
        
        return res.json({
            ...response.data,
            campaignId,
            donorId,
            links: response.data.links
        });
    } catch (error) {
        console.error("Error al crear orden:", {
            message: error.message,
            response: error.response?.data
        });

        return res.status(500).json({
            message: "Error al crear la orden",
            details: error.response?.data || error.message
        });
    }
};

// registrar donación
export const RegisterDonation = async (campaignId, donorId, email, phone, name, token,amount) => {
    try {
        // colocar fecha de hoy
        const donationDate = new Date().toISOString(); // Ej: "2025-04-15T00:00:00.000Z"
        const payload = {
            campaignId,
            amount,
            donationDate,
            donorId,
            email: email || null,
            phone: phone || null,
            name: name || null,
        };
        console.log("Payload de donación:", payload, "token:", token);
        const response = await axios.post("http://192.168.1.80:8080/api/donations", payload, {
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            }
        });
        console.log("Donación registrada:", response.data);
    } catch (error) {
        console.error("Error en captura o registro:", error.response?.data || error.message);
    }
};

// Obtener detalles de transacción
export const getTransactionDetails = async (req, res) => {
    const { transactionId } = req.params;

    try {
        const access_token = await getAccessToken();

        const response = await axios.get(`${PAYPAL_API}/v2/payments/captures/${transactionId}`, {
            headers: {
                Authorization: `Bearer ${access_token}`,
                'Content-Type': 'application/json'
            }
        });

        return res.json({
            success: true,
            data: response.data
        });
    } catch (error) {
        console.error('Error al obtener detalles:', {
            message: error.message,
            response: error.response?.data
        });

        return res.status(500).json({
            success: false,
            message: 'Error al obtener detalles',
            details: error.response?.data || error.message
        });
    }
};

// Cancelar pago
export const cancelPayment = (req, res) => {
    return res.json({
        success: false,
        message: 'Pago cancelado por el usuario',
        cancelled: true
    });
};
