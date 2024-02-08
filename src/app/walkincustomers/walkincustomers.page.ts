import { Component, OnInit } from '@angular/core';
import { Location } from '@angular/common';
import { AppointmentListService } from '../_services/appointmentlist.service';
import { AppointmentList } from '../_models/appointmentlist.model';
import { AlertController, LoadingController } from '@ionic/angular';
import { ToastService } from '../_services/toast.service';
import { SharedService } from '../_services/shared.service';
import { NavigationHandler } from '../_services/navigation-handler.service';
import { Subject } from 'rxjs/internal/Subject';
import { takeUntil } from 'rxjs/internal/operators/takeUntil';
import { DateService } from '../_services/date.service';
import { Storage } from '@ionic/storage';
@Component({
  selector: 'app-walkincustomers',
  templateUrl: './walkincustomers.page.html',
  styleUrls: ['./walkincustomers.page.scss'],
})
export class WalkincustomersPage implements OnInit {

  constructor(
    private appointmentService: AppointmentListService,
    public alertController: AlertController,
    private loadingCtrl: LoadingController,
    private sharedService: SharedService,
    private dateService: DateService,
    private toast: ToastService,
    private nh: NavigationHandler,
    private storage: Storage
  ) {
    this.storage.get('userData').then(x => {
      if (x) {
        this.userData = x;
      }
    });
  }

  dateFilter: string;
  appointments: AppointmentList[];
  appointmentsList: AppointmentList[];
  appointmentDate: string;
  maxFilterDate: string;
  minFilterDate: string;
  page: number;
  totalPages: number;
  totalAppointmentCount: number;
  selectedAppointmentDate: string;
  refreshSubscription = new Subject();
  userData: any;
  walkinCount: number = 0;
  testList: any = [{ value: 1 }, { value: 2 }, { value: 3 }, { value: 4 }, { value: 5 }, { value: 6 }]

  ngOnInit() {
    this.sharedService.currentWalkingAppointmentListRefresh.pipe(takeUntil(this.refreshSubscription)).subscribe((data) => {
      this.appointments = [];
      this.page = 1;
      this.getAppointments(null);
      this.setMaxFilterDate();
    });
  }

  previous() {
    this.nh.GoBackTo('/home/tabs/tab1');
  }

  setMaxFilterDate() {
    const date = this.getNowUTC();
    date.setDate(date.getDate() + 30);
    this.maxFilterDate = `${date.getFullYear()}-${('0' + (date.getMonth() + 1)).slice(-2)}-${('0' + date.getDate()).slice(-2)}`;
    const minDate = this.getNowUTC();
    this.minFilterDate = `${minDate.getFullYear()}-${('0' + (minDate.getMonth() + 1)).slice(-2)}-${('0' + minDate.getDate()).slice(-2)}`;
  }

  async getAppointments(date: Date) {
    const loading = this.loadingCtrl.create();
    loading.then(l => l.present());
    const currentDate = new Date();
    this.appointmentDate = date != null ? (currentDate.toLocaleDateString() === date.toLocaleDateString() ? 'Today' : date.toLocaleDateString()) : 'Current';
    this.selectedAppointmentDate = date != null ? `${date.getFullYear()}-${('0' + (date.getMonth() + 1)).slice(-2)}-${('0' + date.getDate()).slice(-2)}` : null;
    await this.appointmentService.getAppoinmentListWalkin('WALKIN,SPECIAL', this.page, this.selectedAppointmentDate, 'CONFIRMED').subscribe(
      (response) => {
        loading.then(l => l.dismiss());
        if (response && response.status === 'SUCCESS') {
          this.totalPages = response.totalPages;
          this.totalAppointmentCount = response.totalCount;
          for (const item of response.data) {
            item.isCheckedIn = (item.status === 'CHECKIN');
            const length = item.bookedServices.length;
            let serviceList = '';
            for (let i = 0; i < length; i++) {
              serviceList += item.bookedServices[i].name;
              if (i != length - 1) {
                serviceList += ', ';
              }

              item.bookedServicesList = serviceList;
            }
          }
          this.appointments = this.appointments.concat(response.data);
          // let todayDate = new Date();
          // let currentDate = todayDate.getFullYear() + "-" + (todayDate.getMonth() + 1).toString().padStart(2, '0')
          //   + "-" + todayDate.getDate().toString().padStart(2, '0');
          this.appointmentsList = [];
          // this.appointmentsList = this.appointments.filter(x => x.bookingDate == currentDate);
          this.appointmentsList = this.appointments;
          console.log('this.appointmentsList', this.appointmentsList);


          this.walkinCount = this.appointments.length;
          // this.walkinCount = this.appointments.length;

        }
        else {
          this.toast.showToast('Something went wrong. Please try again');
        }
      }
    );
  }

  calculateBookingtime(createdAt: string): string {
    const arr = createdAt.split(/[- :]/);
    const bookedDateTime = new Date(Number(arr[0]), Number(arr[1]) - 1, Number(arr[2]), Number(arr[3]), Number(arr[4]), Number(arr[5]));
    const currentDateTime = this.getNowUTC();
    const diff = (currentDateTime.getTime() - bookedDateTime.getTime());
    const minutes = Math.round(diff / (1000 * 60));
    const hours = Math.round(diff / (1000 * 60 * 60));
    const days = Math.round(diff / (1000 * 60 * 60 * 24));
    if (minutes <= 0) {
      return 'Just Now';
    }
    else if (minutes < 60) {
      return `${minutes} minutes ago`;
    }
    else if (hours <= 23) {
      return `${hours} hours ago`;
    }
    else {
      return `${days} days ago`;
    }
  }

  async presentAcceptAlertConfirm(appointment: AppointmentList, index: number) {
    const alert = await this.alertController.create({
      cssClass: 'my-custom-class',
      header: 'Accept Appointment',
      message: 'Do you want to accept appointment?',
      buttons: [
        {
          text: 'No',
          role: 'cancel',
          handler: (no) => {
            console.log('Appointment Accept Canceled!');
          },
        },
        {
          text: 'Yes',
          cssClass: 'secondary',
          handler: async () => {
            this.updateAppointmentStatus(appointment, 'CONFIRMED', index, null);
          },
        },
      ],
    });

    await alert.present();
  }

  async presentCancelAlertConfirm(appointment: AppointmentList, index: number) {
    const alert = await this.alertController.create({
      cssClass: 'my-custom-class',
      header: 'Cancel Appointment',
      message: 'Do you want to cancel appointment?',
      inputs: [
        {
          name: 'Reason',
          type: 'textarea',
          placeholder: 'Cancellation Remarks',
          cssClass: 'alertTextBox'
        }],
      buttons: [
        {
          text: 'No',
          role: 'cancel',
          handler: (no) => {
            console.log('cancel Canceled!');
          },
        },
        {
          text: 'Yes',
          cssClass: 'secondary',
          handler: async (data) => {
            this.updateAppointmentStatus(appointment, 'CANCELED', index, data.Reason);
          },
        },
      ]
    });

    await alert.present();
  }

  async presentCheckinAlertConfirm(appointment: AppointmentList, index: number) {
    const alert = await this.alertController.create({
      cssClass: 'my-custom-class',
      header: 'Check In',
      message: 'Do you want to mark as Check in? Once marked, you cannot revert back.',
      buttons: [
        {
          text: 'No',
          role: 'cancel',
          handler: (no) => {
            this.appointments[index].isCheckedIn = false;
          },
        },
        {
          text: 'Yes',
          cssClass: 'secondary',
          handler: async () => {
            //   this.appointments[index].status = 'CHECKIN';
            //  this.updateAppointmentStatus(appointment,'CHECKIN',index, null);
            this.appointments[index].status = 'COMPLETED';
            this.updateAppointmentStatus(appointment, 'COMPLETED', index, null);
          },
        }
      ]
    });

    await alert.present();
  }

  updateAppointmentStatus(appointment: AppointmentList, status: string, index: number, reason: string) {
    const loading = this.loadingCtrl.create();
    loading.then(l => l.present());
    this.appointmentService.updateAppointmentStatus(appointment.appointmentId, status, reason).subscribe(
      (response) => {
        loading.then(l => l.dismiss());
        if (response && response.status == 'SUCCESS' && response.data) {
          this.appointments[index].status = status;
          this.appointments.splice(index, 1);
          this.totalAppointmentCount = this.totalAppointmentCount - 1;
          if (this.appointments.length === 0) {
            this.getAppointments(null);
          }
          if (status === 'CANCELED') {
            this.toast.showToast('Appoinment moved to cancel sections');
          } else if (status === 'COMPLETED') {
            this.toast.showToast('Appoinment moved to appoinment History sections');
          }
          this.sharedService.changeAppointmentMannualRefresh(1);
        }
        else {
          this.toast.showToast('Something went wrong. Please try again');
        }
      }
    );
  }

  filterChange(date) {
    this.page = 1;
    this.totalPages = 0;
    this.totalAppointmentCount = 0;
    this.appointments = [];
    this.getAppointments(new Date(date));
  }

  doRefresh(refresher) {
    const date = this.appointmentDate === 'Current' ? null : new Date(this.selectedAppointmentDate);
    this.page = 1;
    this.totalPages = 0;
    this.totalAppointmentCount = 0;
    this.appointments = [];
    this.getAppointments(date).then(data => { refresher.target.complete(); })
      .catch(err => {
        refresher.target.complete();
      });
  }

  loadMoreData(infiniteScroll) {
    this.page = this.page + 1;
    const date = this.appointmentDate === 'Current' ? null : new Date(this.selectedAppointmentDate);
    this.getAppointments(date).then(data => {
      infiniteScroll.target.complete();
      if (this.appointments.length >= this.totalAppointmentCount) {
        infiniteScroll.target.disabled = true;
      }
    })
      .catch(error => { infiniteScroll.target.complete(); });
  }

  getNowUTC() {
    const now = new Date();
    // return new Date(now.getTime() + (now.getTimezoneOffset() * 60000));
    return now;
  }
  openDetail(id: number) {
    this.nh.GoForward('/detailappointment/' + id);
    localStorage.setItem('routing', '/walkincustomers');
  }
  ngOnDestroy() {
    this.refreshSubscription.next();
    this.refreshSubscription.unsubscribe();
  }
  getAMPM(time) {
    return this.dateService.timeConvert(time);
  }

}
