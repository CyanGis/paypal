import axios from 'axios';
import { PAYPAL_API, PAYPAL_API_CLIENT, PAYPAL_API_SECRET, HOST } from '../config.js';

// Función para obtener el token de acceso de PayPal
const getAccessToken = async () => {
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');

    try {
        const { data } = await axios.post(
            `${PAYPAL_API}/v1/oauth2/token`,
            params,
            {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                auth: { username: PAYPAL_API_CLIENT, password: PAYPAL_API_SECRET },
            }
        );
        return data.access_token;
    } catch (error) {
        console.error('Error al obtener el token de acceso:', error.response?.data || error.message);
        throw new Error('Error al obtener el token de acceso');
    }
};

// Crear orden de pago
export const createOrder = async (req, res) => {
    console.log(req.body);
    const { amount, currency_code, idCampaig, idUsuario } = req.body;
   
    try {
        const access_token = await getAccessToken();

        const order = {
            intent: "CAPTURE",
            purchase_units: [{
                amount: {
                    currency_code,
                    value: amount,
                },
                custom_id: idCampaig, 
                reference_id: idUsuario 
            }],
            application_context: {
                brand_name: "mycompany.com",
                landing_page: "NO_PREFERENCE",
                user_action: "PAY_NOW",
                return_url: `${HOST}/capture-order`,
                cancel_url: `${HOST}/cancel-payment`
            },
        };

        const response = await axios.post(
            `${PAYPAL_API}/v2/checkout/orders`,
            order,
            {
                headers: {
                    Authorization: `Bearer ${access_token}`,
                    'Content-Type': 'application/json'
                },
            }
        );

        console.log("Orden creada:", response.data);
        return res.json({ ...response.data, idCampaig, idUsuario });
    } catch (error) {
        console.error("Error al crear la orden:", error.response?.data || error.message);
        return res.status(500).json({ message: "Error al crear la orden" });
    }
};

export const captureOrder = async (req, res) => {
    const { token } = req.query;

    try {
        const access_token = await getAccessToken();

        // Obtener el estado de la orden antes de capturarla
        const orderResponse = await axios.get(
            `${PAYPAL_API}/v2/checkout/orders/${token}`,
            {
                headers: { Authorization: `Bearer ${access_token}` },
            }
        );

        if (orderResponse.data.status !== 'APPROVED') {
            return res.status(400).json({ error: 'Orden no aprobada' });
        }

        // Capturar la orden
        const captureResponse = await axios.post(
            `${PAYPAL_API}/v2/checkout/orders/${token}/capture`,
            {},
            {
                headers: { Authorization: `Bearer ${access_token}` },
            }
        );

        console.log('Pago capturado:', JSON.stringify(captureResponse.data, null, 2));

        // Obtener el ID de la captura de la respuesta correcta
        const captureID = captureResponse.data.purchase_units[0].payments.captures[0].id;

        const idCampana = orderResponse.data.purchase_units[0]?.custom_id || null;
        const idUsuario = orderResponse.data.purchase_units[0]?.reference_id || null;

        // Redirigir al frontend con los datos necesarios
        return res.redirect(
            `http://localhost:5173/campaigns?status=success&transactionId=${captureID}`
        );
    } catch (error) {
        console.error('Error al capturar el pago:', error.message);
        return res.redirect(`http://localhost:5173/campaigns?status=error`);
    }
};

export const getTransactionDetails = async (req, res) => {
    const { transactionId } = req.params; // Se obtiene el ID de la transacción desde la URL

    try {
        const access_token = await getAccessToken();

        const response = await axios.get(
            `${PAYPAL_API}/v2/payments/captures/${transactionId}`,
            {
                headers: { Authorization: `Bearer ${access_token}` },
            }
        );

        return res.json(response.data);
    } catch (error) {
        console.error('Error al obtener detalles de la transacción:', error.response?.data || error.message);
        return res.status(500).json({ message: 'Error al obtener detalles de la transacción' });
    }
};


// Cancelar el pago y redirigir
export const cancelPayment = (req, res) => {
    return res.redirect('http://localhost:5173/campaigns?status=canceled');
};
